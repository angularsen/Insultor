/** Models an event with a generic sender and generic arguments */
export interface IEvent<TArgs> {
	subscribe(fn: (args: TArgs) => void): void
	unsubscribe(fn: (args: TArgs) => void): void
}

export class EventDispatcher<TArgs> implements IEvent<TArgs> {

	private _subscriptions: Array<(args: TArgs) => void> = new Array<(args: TArgs) => void>()

	public subscribe(fn: (args: TArgs) => void): void {
		if (fn) {
			this._subscriptions.push(fn)
		}
	}

	public unsubscribe(fn: (args: TArgs) => void): void {
		const i = this._subscriptions.indexOf(fn)
		if (i > -1) {
			this._subscriptions.splice(i, 1)
		}
	}

	public dispatch(args: TArgs): void {
		for (const handler of this._subscriptions) {
			handler(args)
		}
	}
}

// tslint:disable-next-line:max-classes-per-file
export class EventList<TArgs> {
	private _events: { [name: string]: EventDispatcher<TArgs> } = {}

	public get(name: string): EventDispatcher<TArgs> {

		let event = this._events[name]

		if (event) {
			return event
		}

		event = new EventDispatcher<TArgs>()
		this._events[name] = event
		return event
	}

	public remove(name: string): void {
		delete this._events[name]
	}
}
