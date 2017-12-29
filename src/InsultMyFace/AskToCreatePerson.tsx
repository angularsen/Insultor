import { addMilliseconds, differenceInSeconds } from 'date-fns'
import * as React from 'react'
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'timers'
import { DetectedFaceWithImageData } from '../services/PeriodicFaceDetector'

// TODO Make these configurable
const storageName = 'GitHub'
const accountName = 'TestKonto'

interface AskToRegisterPersonState {
	remainingSeconds: number
}

interface AskToRegisterPersonProps {
	face: DetectedFaceWithImageData
	timeoutMs: number
	onAccept(): void
	onDecline(): void
	onTimeout(): void
}

function secondsUntil(date: Date) {
	const now = new Date()
	return (now > date) ? 0 : differenceInSeconds(date, now)
}

class Component extends React.Component<AskToRegisterPersonProps, AskToRegisterPersonState> {
	private _updateIntervalHandle: NodeJS.Timer
	private _timeoutHandle: NodeJS.Timer

	constructor(props: AskToRegisterPersonProps) {
		super()

		const { timeoutMs } = props
		const timeoutOn = addMilliseconds(new Date(), timeoutMs)

		this._timeoutHandle = setTimeout(() => {
			this.props.onTimeout()
			clearTimeout(this._timeoutHandle)
		}, timeoutMs)

		// Periodically update countdown
		this._updateIntervalHandle = setInterval(() => {
			this.setState({ remainingSeconds: secondsUntil(timeoutOn) })
		}, 1000)

		this.state = {
			remainingSeconds: secondsUntil(timeoutOn),
		}
	}

	public componentWillUnmount() {
		this._clearTimers()
	}

	public render() {
		const { remainingSeconds } = this.state
		const { face } = this.props

		return (
			<div>
				<div style={{ textAlign: 'center', fontSize: '2em' }}><span>Vil du være med?</span></div>
				<div style={{ textAlign: 'center' }}><img src={face.imageDataUrl} style={{ width: 400 }} /></div>
				<div style={{ textAlign: 'center', fontSize: '2em' }}><span>Så heng på!</span></div>

				<div style={{ display: 'flex', flexDirection: 'row' }}>
					<button className='btn btn-primary' type='button' onClick={() => this._addPersonClicked()}>Legg til person</button>
					<button className='btn btn-default' type='button' onClick={() => this._declineClicked()}>Ikke nå ({remainingSeconds} s...)</button>
				</div>

				<div style={{ textAlign: 'center', fontSize: '.5em' }}><i>
					Hvis du registrerer deg vil bildet av deg lagres på {storageName} og bli tilgjengelig for de andre brukerne på kontoen {accountName}.
				</i></div>
			</div >
		)
	}

	private _addPersonClicked() {
		this._clearTimers()
		this.props.onAccept()
	}

	private _declineClicked() {
		this._clearTimers()
		this.props.onDecline()
	}

	private _clearTimers() {
		clearInterval(this._updateIntervalHandle)
		clearTimeout(this._timeoutHandle)
	}
}

export default Component
