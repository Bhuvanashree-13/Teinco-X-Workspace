import type { AskFact } from './ask-ai.js'

/**
 * Structured response format for Vyom
 * Breaks down answers into semantic components for better UI rendering
 */

export interface VyomStructuredResponse {
  status: 'answered' | 'insufficient_evidence' | 'error'
  scope: 'workspace' | 'general'

  // Core response components
  summary: string // Brief answer summary
  details: {
    findings: string[] // Key findings (bulleted)
    metrics?: Record<string, string | number> // KPIs and numbers
    timeline?: Array<{ period: string; value: string | number }>
    breakdown?: Array<{ label: string; value: string | number; percentage?: number }>
  }

  // Supporting information
  evidence: {
    facts: AskFact[]
    factCount: number
    dataQuality: 'high' | 'medium' | 'low'
  }

  // Analysis and recommendations
  analysis?: {
    trends?: string[] // Trend observations
    risks?: string[] // Potential risks
    opportunities?: string[] // Opportunities
    recommendations?: string[] // Suggested actions
  }

  // Proposed actions
  proposal?: {
    type: string // create_task | update_subscription | approve_leave | etc
    description: string
    payload: Record<string, any>
    impact?: string // Expected impact
  }

  // Context
  context: {
    period: string
    retrievedAt: string
    coverage: string[] // What data was included
    confidence: number // 0-1, how confident is this answer
  }
}

/**
 * Extract structured components from Vyom's answer text
 */
export function parseAnswer(answer: string): {
  summary: string
  findings: string[]
  metrics: Record<string, string | number>
  trends?: string[]
  risks?: string[]
  opportunities?: string[]
  recommendations?: string[]
} {
  const lines = answer.split('\n').map(l => l.trim()).filter(Boolean)

  const result = {
    summary: '',
    findings: [] as string[],
    metrics: {} as Record<string, string | number>,
    trends: [] as string[],
    risks: [] as string[],
    opportunities: [] as string[],
    recommendations: [] as string[]
  }

  let currentSection = 'summary'

  for (const line of lines) {
    if (line.match(/^(summary|key findings|metrics|trends|risks|opportunities|recommendations):/i)) {
      currentSection = line.split(':')[0].toLowerCase()
      continue
    }

    if (line.startsWith('-') || line.startsWith('•')) {
      const text = line.substring(1).trim()

      if (currentSection === 'summary' && !result.summary) {
        result.summary = text
      } else if (currentSection === 'key findings') {
        result.findings.push(text)
      } else if (currentSection === 'trends') {
        result.trends!.push(text)
      } else if (currentSection === 'risks') {
        result.risks!.push(text)
      } else if (currentSection === 'opportunities') {
        result.opportunities!.push(text)
      } else if (currentSection === 'recommendations') {
        result.recommendations!.push(text)
      }
    } else if (currentSection === 'metrics' && line.includes(':')) {
      const [key, value] = line.split(':').map(s => s.trim())
      const numValue = parseFloat(value)
      result.metrics[key] = isNaN(numValue) ? value : numValue
    } else if (!result.summary) {
      result.summary = line
    }
  }

  return result
}

/**
 * Format raw Vyom response into structured format
 */
export function formatVyomResponse(
  rawResponse: any,
  facts: AskFact[]
): VyomStructuredResponse {
  const parsed = parseAnswer(rawResponse.answer || '')

  // Calculate confidence based on:
  // 1. Number of supporting facts
  // 2. Fact quality (workspace vs general)
  // 3. Response completeness
  const factQuality = facts.filter(f => f.id.startsWith('feature-')).length === 0 ? 'high' : 'medium'
  const confidence = Math.min(
    1,
    (facts.length / 8) * 0.4 + // Fact count (up to 8)
    (factQuality === 'high' ? 0.6 : 0.4) + // Fact quality
    (parsed.findings.length > 0 ? 0.2 : 0) // Has findings
  )

  return {
    status: rawResponse.status,
    scope: rawResponse.scope,

    summary: parsed.summary || rawResponse.answer?.split('\n')[0] || 'No clear answer',

    details: {
      findings: parsed.findings.length > 0 ? parsed.findings : extractBulletPoints(rawResponse.answer),
      metrics: parsed.metrics,
      timeline: extractTimeline(rawResponse.answer),
      breakdown: extractBreakdown(rawResponse.answer)
    },

    evidence: {
      facts,
      factCount: facts.length,
      dataQuality: factQuality as 'high' | 'medium' | 'low'
    },

    analysis: {
      trends: parsed.trends,
      risks: parsed.risks,
      opportunities: parsed.opportunities,
      recommendations: parsed.recommendations
    },

    proposal: rawResponse.proposal ? {
      type: rawResponse.proposal.action || 'unknown',
      description: `${rawResponse.proposal.action}: ${rawResponse.proposal.entityType}`,
      payload: rawResponse.proposal.payload,
      impact: rawResponse.proposal.impact
    } : undefined,

    context: {
      period: rawResponse.period || 'current',
      retrievedAt: rawResponse.retrievedAt || new Date().toISOString(),
      coverage: rawResponse.coverage || [],
      confidence
    }
  }
}

/**
 * Extract bullet points from answer text
 */
function extractBulletPoints(text: string): string[] {
  const lines = text.split('\n')
  return lines
    .filter(l => l.match(/^[-•*]\s+/))
    .map(l => l.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean)
}

/**
 * Extract timeline from answer (e.g., "Jan: ₹100k, Feb: ₹120k")
 */
function extractTimeline(text: string): Array<{ period: string; value: string | number }> | undefined {
  const matches = text.match(/([a-zA-Z]+):\s*(₹?[\d,]+[KML]?)/g)
  if (!matches || matches.length < 2) return undefined

  return matches.map(match => {
    const [period, value] = match.split(':').map(s => s.trim())
    const numValue = parseFloat(value.replace(/[₹,KML]/g, ''))
    return {
      period,
      value: isNaN(numValue) ? value : numValue
    }
  })
}

/**
 * Extract breakdown data (e.g., "Software: 40%, Cloud: 35%")
 */
function extractBreakdown(text: string): Array<{ label: string; value: string | number; percentage?: number }> | undefined {
  const lines = text.split('\n')
  const breakdown: Array<{ label: string; value: string | number; percentage?: number }> = []

  for (const line of lines) {
    const match = line.match(/([^:]+):\s*([\d,]+)\s*\(([0-9.]+)%\)/)
    if (match) {
      const [, label, value, percentage] = match
      breakdown.push({
        label: label.trim(),
        value: parseFloat(value.replace(/,/g, '')),
        percentage: parseFloat(percentage)
      })
    }
  }

  return breakdown.length > 0 ? breakdown : undefined
}

/**
 * Format response for different output formats
 */
export function formatForUI(response: VyomStructuredResponse): Record<string, any> {
  return {
    // Header
    header: {
      status: response.status,
      confidence: Math.round(response.context.confidence * 100),
      scope: response.scope,
      period: response.context.period
    },

    // Main answer
    answer: {
      summary: response.summary,
      findings: response.details.findings
    },

    // Visualizable data
    data: {
      metrics: response.details.metrics && Object.keys(response.details.metrics).length > 0 ? response.details.metrics : undefined,
      timeline: response.details.timeline,
      breakdown: response.details.breakdown
    },

    // Analysis
    insights: {
      trends: response.analysis?.trends,
      risks: response.analysis?.risks,
      opportunities: response.analysis?.opportunities,
      recommendations: response.analysis?.recommendations
    },

    // Evidence
    evidence: {
      count: response.evidence.factCount,
      quality: response.evidence.dataQuality,
      facts: response.evidence.facts.slice(0, 5) // Show top 5
    },

    // Actions
    proposal: response.proposal,

    // Meta
    meta: {
      retrievedAt: response.context.retrievedAt,
      coverage: response.context.coverage
    }
  }
}

/**
 * Format response for text/markdown output
 */
export function formatForMarkdown(response: VyomStructuredResponse): string {
  let md = ''

  // Header
  md += `# Vyom Response\n`
  md += `**Status:** ${response.status} | **Confidence:** ${Math.round(response.context.confidence * 100)}% | **Scope:** ${response.scope}\n\n`

  // Summary
  md += `## Summary\n${response.summary}\n\n`

  // Findings
  if (response.details.findings.length > 0) {
    md += `## Key Findings\n`
    response.details.findings.forEach(f => md += `- ${f}\n`)
    md += '\n'
  }

  // Metrics
  if (response.details.metrics && Object.keys(response.details.metrics).length > 0) {
    md += `## Metrics\n`
    Object.entries(response.details.metrics).forEach(([k, v]) => md += `- **${k}:** ${v}\n`)
    md += '\n'
  }

  // Timeline
  if (response.details.timeline?.length) {
    md += `## Timeline\n`
    response.details.timeline.forEach(t => md += `- **${t.period}:** ${t.value}\n`)
    md += '\n'
  }

  // Breakdown
  if (response.details.breakdown?.length) {
    md += `## Breakdown\n`
    response.details.breakdown.forEach(b => md += `- **${b.label}:** ${b.value}${b.percentage ? ` (${b.percentage}%)` : ''}\n`)
    md += '\n'
  }

  // Analysis
  if (response.analysis) {
    if (response.analysis.trends?.length) {
      md += `## Trends\n${response.analysis.trends.map(t => `- ${t}`).join('\n')}\n\n`
    }
    if (response.analysis.risks?.length) {
      md += `## Risks\n${response.analysis.risks.map(r => `- ${r}`).join('\n')}\n\n`
    }
    if (response.analysis.opportunities?.length) {
      md += `## Opportunities\n${response.analysis.opportunities.map(o => `- ${o}`).join('\n')}\n\n`
    }
    if (response.analysis.recommendations?.length) {
      md += `## Recommendations\n${response.analysis.recommendations.map(r => `- ${r}`).join('\n')}\n\n`
    }
  }

  // Evidence
  md += `## Evidence\n`
  md += `- **Facts used:** ${response.evidence.factCount}\n`
  md += `- **Data quality:** ${response.evidence.dataQuality}\n`
  md += `- **Retrieved:** ${new Date(response.context.retrievedAt).toLocaleString()}\n\n`

  // Proposal
  if (response.proposal) {
    md += `## Proposed Action\n`
    md += `- **Type:** ${response.proposal.type}\n`
    md += `- **Description:** ${response.proposal.description}\n`
    if (response.proposal.impact) md += `- **Impact:** ${response.proposal.impact}\n`
    md += '\n'
  }

  return md
}
