import { mergeDeep } from './utils'
import { EventDispatcher, IEvent } from './utils/Events'

function noopLog(msg: string): void {
	// Do nothing
}

function defaultOnInvalidTransition(from: any, name: any) {
	throw new Error(`Transition not configured: from[${from}], transition[${name}]`)
}

export interface InputTransition<States> {
	to: States
}

export interface Lifecycle<State, TransitionName> {
	transitionName: TransitionName
	from: State
	to: State
	payload?: any
}

interface StateConfig<States, TransitionName extends string> {
	onEnter?: (lifecycle: Lifecycle<States, TransitionName>) => void
	onExit?: (lifecycle: Lifecycle<States, TransitionName>) => void
	allow: {
		[T in (TransitionName | 'any')]?: InputTransition<States>
	}
	ignore?: TransitionName[]
}

type InputStates<State extends string, TransitionName extends string> =
	{ [s in State]: StateConfig<State, TransitionName> }
	&
	{ 'any': StateConfig<State, TransitionName> }

interface OptsRequired<State extends string, TransitionName extends string> {
		initialState: State,
		states: InputStates<State, TransitionName>,
}

interface OptsOptional<State, TransitionName> {
		onInvalidTransition?: (from: State, name: TransitionName) => void
		log?: (msg: string, ...args: any[]) => void
}

type Opts<State extends string, TransitionName extends string> =
	OptsRequired<State, TransitionName> &
	OptsOptional<State, TransitionName>

export class TypedStateMachine<
	State extends string,
	TransitionTriggers extends object,
	TransitionName extends string = keyof TransitionTriggers
	> {

	public readonly states: InputStates<State, TransitionName>
	private readonly _onTransition = new EventDispatcher<Lifecycle<State, TransitionName>>()

	public get onTransition(): IEvent<Lifecycle<State, TransitionName>> { return this._onTransition }
	public get state(): State { return this._state }
	public get history(): State[] { return this._history }

	private readonly _history: State[] = []
	private readonly onInvalidTransition: (from: State, name: TransitionName) => void
	private readonly log: (msg: string, ...args: any[]) => void
	private _state: State

	constructor(opts: Opts<State, TransitionName>) {
		this._state = opts.initialState
		this.states = opts.states
		this.log = opts.log || noopLog
		this.onInvalidTransition = opts.onInvalidTransition || defaultOnInvalidTransition
	}

	public can(transitionName: TransitionName): boolean {
		return this._getTransition(this._state, transitionName) ? true : false
	}

	public trigger(transitionName: TransitionName, payload?: any): void {
		const from = this._state

		const transition = this._getTransition(from, transitionName)
		if (!transition) {
			this.onInvalidTransition(from, transitionName); return
		}

		const to = transition.to
		const fromConfig = this._getStateConfig(from)
		const toConfig = this._getStateConfig(to)
		try {
			const lifecycle = { from, to, transitionName, payload }

			if (fromConfig && fromConfig.onExit) {
				fromConfig.onExit(lifecycle)
			}

			this.log(`Begin [${transitionName}] from [${from} => ${to}].`)
			this._state = to
			this._history.push(to)
			this._onTransition.dispatch({ from, transitionName, to, payload })

			if (toConfig && toConfig.onEnter) {
				toConfig.onEnter(lifecycle)
			}
			this.log(`End [${transitionName}] from [${from} => ${to}].`)
		} catch (err) {
			this.log(`Transition action threw an error.`, err)
		}
	}

	private _getStateConfig(state: State): StateConfig<State, TransitionName> {
		// TODO Workaround, casting to type as TypeScript is confused about the union with 'any'
		const castedFromConfigs = this.states as {[s in State]: StateConfig<State, TransitionName> }
		const fromStateConfig: StateConfig<State, TransitionName> = castedFromConfigs[state]
		const anyStateConfig: StateConfig<State, TransitionName> = this.states.any

		// Merge transition configs from current state and 'any' state
		const stateConfig = mergeDeep(anyStateConfig, fromStateConfig)
		return stateConfig
	}

	private _getTransition(from: State, transitionName: TransitionName): InputTransition<State> | undefined {
		const stateConfig = this._getStateConfig(this._state)

		const transition = (stateConfig.allow[transitionName] || stateConfig.allow.any)
		return transition
	}

}

export default TypedStateMachine
