import {} from 'jasmine'
// tslint:disable:no-var-requires
// tslint:disable-next-line:variable-name
const StateMachine = require('javascript-state-machine')

/** Utility function to create a K:V from a list of strings */
function strEnum<T extends string>(o: T[]): {[K in T]: K} {
	return o.reduce((res, key) => {
		res[key] = key
		return res
	}, Object.create(null))
}

// tslint:disable-next-line:variable-name
const Action = strEnum([
	'start',
	'stop',
	'presenceDetected',
	'noPresenceDetected',
	'facesDetected',
	'facesIdentified',
	'commentsDelivered',
])
type Action = keyof typeof Action

// tslint:disable-next-line:variable-name
const State = strEnum([
	'Idle',
	'DetectPresence',
	'DetectFaces',
	'IdentifyFaces',
	'DeliverComments',
])
type State = keyof typeof State

type MyStateMachineEvent = (...args: any[]) => void

interface MyStateMachine {
	state: State
	start?: MyStateMachineEvent
	stop?: MyStateMachineEvent
	presenceDetected?: MyStateMachineEvent
	noPresenceDetected?: MyStateMachineEvent
	facesDetected?: MyStateMachineEvent
	facesIdentified?: MyStateMachineEvent
	commentsDelivered?: MyStateMachineEvent
}

interface MyConfig {
	init?: State | { state: State, event: Action, defer: boolean }
	transitions?: MyStateMachineEventDef[]
	callbacks?: {
		[s: string]: (event?: Action, from?: State, to?: State, ...args: any[]) => any;
	}
}

interface MyStateMachineEventDef {
	name: Action
	from: '*' | State | State[]
	to: State
}

const config: MyConfig = {
		init: 'Idle',
		transitions : [
			{ from: '*',               name: 'stop',               to: 'Idle' },
			{ from: 'Idle',            name: 'start',              to: 'DetectPresence' },
			{ from: 'DetectPresence',  name: 'presenceDetected',   to: 'DetectFaces' },
			{ from: 'DetectFaces',     name: 'facesDetected',      to: 'IdentifyFaces' },
			{ from: 'DetectFaces',     name: 'noPresenceDetected', to: 'DetectPresence' },
			{ from: 'IdentifyFaces',   name: 'facesIdentified',    to: 'DeliverComments' },
			{ from: 'DeliverComments', name: 'commentsDelivered',  to: 'DetectFaces' },
		],
}

class InsultorStateMachine {
	private _fsm: MyStateMachine

	constructor(initialState?: State) {

		if (initialState) {
			config.init = initialState
		}
		this._fsm = new StateMachine(config)
	}

	get current(): State { return this._fsm.state }

	// Proxy methods for strongly typed args
	public start = () => this._fsm.start()
	public stop = () => this._fsm.stop()
	public presenceDetected() { this._fsm.presenceDetected() }
	public noPresenceDetected() { this._fsm.noPresenceDetected() }
	public facesIdentified() { this._fsm.facesIdentified() }
	public commentsDelivered() { this._fsm.commentsDelivered() }
}

describe('InsultorStateMachine', () => {
	it('Defaults to start in Idle state.', () => {
			expect(new InsultorStateMachine().current).toBe('Idle')
	})
	it('When in `Idle`, action `Start` transitions to `DetectingMotion`', () => {
		const sm = new InsultorStateMachine('Idle')
		// Act
		sm.start()
		expect(sm.current).toBe('DetectPresence')
	})
})
