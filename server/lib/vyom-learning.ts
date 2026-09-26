import { prisma } from '../db.js'

export type FeedbackType = 'correction' | 'clarification' | 'appreciation' | 'error'
export type Severity = 'high' | 'medium' | 'low'

export interface SubmitFeedbackInput {
  messageId: number
  type: FeedbackType
  originalResponse: string
  correction?: string
  category?: string
  severity?: Severity
  isAccurate?: boolean
  helpful?: boolean
}

// Extract learning pattern from a correction
export async function extractLearningPattern(feedback: any): Promise<void> {
  if (feedback.type !== 'correction' && feedback.type !== 'error') return

  const keywords = extractKeywords(feedback.originalResponse, feedback.correction)
  const pattern = `${feedback.category}_${feedback.type}_${keywords.join('_')}`.toLowerCase().slice(0, 100)

  const existing = await prisma.vyomLearning.findUnique({ where: { pattern } })

  if (existing) {
    // Update existing learning pattern
    await prisma.vyomLearning.update({
      where: { pattern },
      data: {
        occurrenceCount: existing.occurrenceCount + 1,
        confidence: Math.min(1, existing.confidence + 0.05), // Increase confidence slightly
        relatedFeedbackIds: JSON.stringify([
          ...(existing.relatedFeedbackIds ? JSON.parse(existing.relatedFeedbackIds) : []),
          feedback.id
        ]).slice(0, 2000),
        updatedAt: new Date()
      }
    })
  } else {
    // Create new learning pattern
    await prisma.vyomLearning.create({
      data: {
        pattern,
        description: `Correction: ${feedback.originalResponse.slice(0, 100)} → ${feedback.correction?.slice(0, 100) || 'needs revision'}`,
        context: feedback.category || 'general',
        correction: feedback.correction || 'Response needs correction',
        category: feedback.category || 'general',
        confidence: 0.6,
        keywords: JSON.stringify(keywords),
        relatedFeedbackIds: JSON.stringify([feedback.id]),
        applicableCategories: JSON.stringify([feedback.category || 'general'])
      }
    })
  }
}

// Extract keywords from text for pattern matching
function extractKeywords(original: string, correction?: string): string[] {
  const text = (original + ' ' + (correction || '')).toLowerCase()
  const words = text.match(/\b[a-z]{3,}\b/g) || []
  const unique = [...new Set(words)]
  return unique.slice(0, 5) // Limit to 5 keywords
}

// Get applicable learning patterns for a response context
export async function getApplicableLearnings(category: string, keywords: string[]): Promise<any[]> {
  const learnings = await prisma.vyomLearning.findMany({
    where: {
      isActive: true,
      category: category || 'general',
      confidence: { gte: 0.5 }
    },
    orderBy: [{ confidence: 'desc' }, { successRate: 'desc' }],
    take: 5
  })

  // Filter by keyword relevance
  return learnings.filter(learning => {
    if (!learning.keywords) return true
    try {
      const learningKeywords = JSON.parse(learning.keywords) as string[]
      return keywords.some(kw => learningKeywords.some(lkw => lkw.includes(kw.slice(0, 3))))
    } catch {
      return true
    }
  })
}

// Submit feedback on an AI response
export async function submitFeedback(userId: number, input: SubmitFeedbackInput): Promise<any> {
  // Get the message
  const message = await prisma.vyomMessage.findUnique({
    where: { id: input.messageId },
    include: { conversation: true }
  })

  if (!message) throw new Error('Message not found')
  if (message.conversation.userId !== userId) throw new Error('Unauthorized')

  // Create feedback record
  const feedback = await prisma.vyomFeedback.create({
    data: {
      messageId: input.messageId,
      userId,
      type: input.type,
      originalResponse: input.originalResponse,
      correction: input.correction || null,
      category: input.category || null,
      severity: input.severity || 'medium',
      isAccurate: input.isAccurate,
      helpful: input.helpful
    }
  })

  // Extract learning pattern if it's a correction
  await extractLearningPattern(feedback)

  // Update conversation metrics
  await updateConversationMetrics(message.conversationId)

  return feedback
}

// Update metrics for a conversation
export async function updateConversationMetrics(conversationId: number): Promise<void> {
  const messages = await prisma.vyomMessage.findMany({
    where: { conversationId },
    include: { feedback: true }
  })

  const feedbackMessages = messages.filter(m => m.feedback)
  const correctMessages = feedbackMessages.filter(m => m.feedback?.isAccurate === true).length
  const incorrectMessages = feedbackMessages.filter(m => m.feedback?.isAccurate === false).length

  const metrics = await prisma.vyomConversationMetrics.findUnique({
    where: { conversationId }
  })

  const feedbackRate = messages.length > 0 ? feedbackMessages.length / messages.length : 0
  const satisfaction =
    feedbackMessages.length > 0
      ? feedbackMessages.filter(m => m.feedback?.helpful === true).length / feedbackMessages.length
      : undefined

  if (metrics) {
    await prisma.vyomConversationMetrics.update({
      where: { conversationId },
      data: {
        totalMessages: messages.length,
        correctMessages,
        incorrectMessages,
        feedbackProvided: feedbackMessages.length,
        feedbackRate,
        userSatisfaction: satisfaction || null
      }
    })
  } else {
    await prisma.vyomConversationMetrics.create({
      data: {
        conversationId,
        totalMessages: messages.length,
        correctMessages,
        incorrectMessages,
        feedbackProvided: feedbackMessages.length,
        feedbackRate,
        userSatisfaction: satisfaction || null
      }
    })
  }
}

// Get learning insights for a user
export async function getLearningInsights(userId: number, limit = 10): Promise<any> {
  const conversations = await prisma.vyomConversation.findMany({
    where: { userId },
    include: { metrics: true },
    orderBy: { updatedAt: 'desc' },
    take: limit
  })

  const totalFeedback = conversations.reduce((sum, c) => sum + (c.metrics?.feedbackProvided || 0), 0)
  const avgAccuracy = conversations.filter(c => c.metrics).length > 0
    ? conversations.reduce((sum, c) => sum + ((c.metrics?.correctMessages || 0) / Math.max(1, c.metrics?.feedbackProvided || 1)), 0) / conversations.filter(c => c.metrics).length
    : 0

  return {
    totalConversations: conversations.length,
    totalFeedback,
    averageAccuracy: avgAccuracy,
    averageSatisfaction: conversations.filter(c => c.metrics?.userSatisfaction).reduce((sum, c) => sum + (c.metrics?.userSatisfaction || 0), 0) / Math.max(1, conversations.filter(c => c.metrics?.userSatisfaction).length),
    recentConversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      totalMessages: c.metrics?.totalMessages || 0,
      feedbackRate: c.metrics?.feedbackRate || 0,
      accuracy: c.metrics?.feedbackProvided ? (c.metrics.correctMessages / c.metrics.feedbackProvided) : undefined
    }))
  }
}

// Apply learnings to improve a response (CAG mechanism)
export async function refineResponseWithLearnings(
  originalResponse: string,
  category: string,
  keywords: string[]
): Promise<{ refined: boolean; suggestion?: string; learningUsed?: string }> {
  const applicableLearnings = await getApplicableLearnings(category, keywords)

  if (applicableLearnings.length === 0) return { refined: false }

  const topLearning = applicableLearnings[0]

  if (topLearning.successRate < 0.3) return { refined: false } // Only apply if success rate is decent

  // Mark learning as used
  await prisma.vyomLearning.update({
    where: { id: topLearning.id },
    data: {
      applicationCount: topLearning.applicationCount + 1,
      lastUsedAt: new Date(),
      successRate: (topLearning.successRate * topLearning.applicationCount + 0.8) / (topLearning.applicationCount + 1) // Assume 0.8 success if we're applying it
    }
  })

  return {
    refined: true,
    suggestion: topLearning.correction,
    learningUsed: topLearning.pattern
  }
}
