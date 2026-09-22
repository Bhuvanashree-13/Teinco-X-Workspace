import { Pressable, Text, View } from 'react-native'
import { colors, themedStyles, useMobileTheme, shortDate } from '../theme'
import { Button, Icon, Panel, s, Tag } from './Ui'
import type { Row } from './domain'
import { ProjectLogo } from './ProjectLogo'

export function ProjectCard({ project, issues, onOpen, onAdd, onTask, onMoveUp, onMoveDown }: { project: Row; issues?: Row[] | null; onOpen: () => void; onAdd?: () => void; onTask: (task: Row) => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
  useMobileTheme()
  const tasks = issues?.filter(task => task.projectId === project.id)
  const total = project._count?.workItems ?? 0
  // The issue endpoint is capped. Only show project-wide totals when all tasks were received.
  const complete = !!tasks && tasks.length === total
  const done = tasks?.filter(task => task.status === 'done').length ?? 0
  const progress = total ? Math.round(done / total * 100) : 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const overdue = (tasks ?? []).filter(task => task.status !== 'done' && task.dueDate && new Date(task.dueDate) < today).length
  const preview: Row[] = (tasks ?? project.workItems ?? []).filter((task: Row) => task.status !== 'done').slice(0, 3)
  return <Panel>
    <View style={p.heading}><ProjectLogo logoDataUrl={project.logoDataUrl} color={project.color} size={54} /><View style={{ flex: 1 }}><Text style={p.title}>{project.name}</Text><Text style={s.caption}>{total} tasks{project.code ? ` · ${project.code}` : ''}</Text></View>{(onMoveUp || onMoveDown) && <View style={p.order}><Text style={p.orderLabel}>Priority</Text><View style={{ flexDirection: 'row' }}>{onMoveUp && <Pressable accessibilityRole="button" accessibilityLabel={`Move ${project.name} up`} onPress={onMoveUp} style={p.orderButton}><Icon name="chevron-up" size={18} /></Pressable>}{onMoveDown && <Pressable accessibilityRole="button" accessibilityLabel={`Move ${project.name} down`} onPress={onMoveDown} style={p.orderButton}><Icon name="chevron-down" size={18} /></Pressable>}</View></View>}</View>
    {complete && total > 0 && <View style={p.progress}><View style={p.progressHeading}><Text style={p.progressLabel}>{done} of {total} completed</Text><Text style={p.progressValue}>{progress}%</Text></View><View accessible accessibilityRole="progressbar" accessibilityLabel={`${project.name} completion`} accessibilityValue={{ min: 0, max: total, now: done }} style={p.track}><View style={[p.fill, { width: `${progress}%` }]} /></View></View>}
    {complete && overdue > 0 && <Text style={p.overdue}>{overdue} overdue {overdue === 1 ? 'task' : 'tasks'}</Text>}
    {!complete && <Text style={s.caption}>Recent tasks · open project for more</Text>}
    {preview.map(task => <Pressable accessibilityRole="button" key={task.id} onPress={() => onTask(task)} style={({ pressed }) => [p.task, pressed && { opacity: .65 }]}>
      <View style={p.avatar}><Text style={p.initials}>{task.assignee?.name?.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || '—'}</Text></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={p.taskTitle}>{task.summary}</Text><Text style={s.caption}>{task.assignee?.name || 'Unassigned'}{task.dueDate ? ` · ${shortDate(task.dueDate)}` : ''}</Text><Tag value={task.status} /></View>
    </Pressable>)}
    {complete && preview.length === 0 && <Text style={s.caption}>{total ? 'All tasks completed.' : 'Add the first task to get started.'}</Text>}
    <View style={p.actions}><View style={p.action}><Button label="View project" onPress={onOpen} /></View>{onAdd && <View style={p.action}><Button secondary label="Add task" icon="add" onPress={onAdd} /></View>}</View>
  </Panel>
}
const p = themedStyles(() => ({
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { color: colors.ink, fontSize: 20, lineHeight: 27, letterSpacing: -.4, fontWeight: '700' },
  progress: { gap: 10, paddingVertical: 14 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  progressLabel: { flexShrink: 1, color: colors.muted, fontSize: 13, lineHeight: 20 },
  progressValue: { color: colors.accent, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  overdue: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  task: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 64, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  taskTitle: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  action: { flexGrow: 1, flexBasis: 140 },
  order: { alignItems: 'center', gap: 2 }, orderLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' }, orderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.softBlue },
}))
