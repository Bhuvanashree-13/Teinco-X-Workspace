import type { Row } from './domain'
export type RootStack = {
  Tabs: undefined
  Records: { module: string; query?: string }
  Detail: { module: string; row: Row }
  Edit: { module: string; row?: Row }
  Analytics: undefined
  Flow: undefined
  AskAI: undefined
  Settings: undefined
  Account: undefined
}
