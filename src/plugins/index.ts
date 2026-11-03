import type { Driver } from '../drivers/types'
import type { Point } from '../geometry'
import type { Human, Target } from '../human'
import type { Random } from '../random'

export type ActionType = 'move' | 'hover' | 'click' | 'drag' | 'type' | 'press' | 'scroll' | 'pause'

/** What's about to happen (or just happened), passed to plugin hooks. */
export interface Action {
    type: ActionType
    target?: Target
    text?: string
}

export interface PluginContext {
    human: Human
    driver: Driver
    random: Random
}

/**
 * A plugin hooks into a human's lifecycle. Every hook is optional. `setup` runs once, before the
 * first action; `beforeAction`/`afterAction` wrap each public action; `onMove` runs for every
 * cursor step, so keep it fast and don't await anything in it.
 */
export interface HumanPlugin {
    readonly name: string
    setup?(context: PluginContext): void | Promise<void>
    beforeAction?(action: Action, context: PluginContext): void | Promise<void>
    afterAction?(action: Action, context: PluginContext): void | Promise<void>
    onMove?(point: Point, context: PluginContext): void
}

/** Identity helper so TypeScript checks and autocompletes a custom plugin. */
export const definePlugin = <T extends HumanPlugin>(plugin: T): T => plugin
