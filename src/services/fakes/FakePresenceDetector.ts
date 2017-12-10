import { IPresenceDetector } from '../PresenceDetector'
import { EventDispatcher, IEvent } from '../utils/Events'

export class FakePresenceDetector implements IPresenceDetector {
	public get onMotionScore(): IEvent<number> { return this._onMotionScore }
	private _isDetected: boolean = false
	private _onMotionScore = new EventDispatcher<number>()
	private _onIsDetectedChanged = new EventDispatcher<boolean>()

	public get onIsDetectedChanged(): IEvent<boolean> { return this._onIsDetectedChanged }

	public start(): void {
		console.log('FakePresenceDetector: Start detecting presence.')
	}
	public stop(): void {
		console.log('FakePresenceDetector: Stop detecting presence.')
	}
	public addMotionScore(motionScore: number, receivedOnDate: Date): void {
		console.log('FakePresenceDetector: Added motion score ' + motionScore)
		this._onMotionScore.dispatch(motionScore)
	}
	public get isDetected() {
		return this._isDetected
	}
	public set isDetected(isDetected: boolean) {
		if (isDetected === this._isDetected) { return }
		this._isDetected = isDetected
		this._onIsDetectedChanged.dispatch(isDetected)
	}
}

export default FakePresenceDetector
