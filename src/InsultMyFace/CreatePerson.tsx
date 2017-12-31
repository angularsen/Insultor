import * as React from 'react'

import Selfie from '../components/Selfie'
import { AddPersonParams } from '../services/DataStore'
import { DetectedFaceWithImageData } from '../services/PeriodicFaceDetector'

interface State {
	canAddPerson: boolean
}

interface Props {
	readonly face: DetectedFaceWithImageData
	createPerson(params: AddPersonParams): void
	cancel(): void
}

class Component extends React.Component<Props, State> {
	private _lastAutoFilledNickname: string = ''
	private _selfie: Selfie | null
	private _addFullName: HTMLInputElement | null // Option<HTMLInputElement>
	private _addNickname: HTMLInputElement | null // Option<HTMLInputElement>

	constructor(props: Props) {
		super(props)
		this.state = {
			canAddPerson: false,
		}
	}

	public render() {
		return (
			<div>
				<h3>Legg til person</h3>
				<form>
					<Selfie ref={ref => this._selfie = ref} desiredWidth={1920} desiredHeight={1080}
						initialPhotoDataUrl={this.props.face.imageDataUrl}
						onPhotoDataUrlChanged={_ => this._updateCanAddPerson()} />

					<div className='form-group'>
						<label htmlFor='addFullName'>Fornavn</label>
						<input id='addFullName' type='text' className='form-control' placeholder='Eks: Ola'
							onChange={ev => { this._onFirstNameChange(ev.target.value); this._updateCanAddPerson() }}
							ref={(x) => { this._addFullName = x/*Option.from(x)*/ }} />
					</div>

					<div className='form-group'>
						<label htmlFor='addNickname'>Kallenavn</label>
						<input id='addNickname' type='text' className='form-control' placeholder='Eks: Ebola'
							onChange={_ => { this._updateCanAddPerson() }}
							ref={(x) => this._addNickname = x/*Option.from(x)*/} />
					</div>

					<button type='button' className='btn btn-primary'
						onClick={_ => this._createPersonAsync()} disabled={!this.state.canAddPerson}>Opprett person</button>

					<button type='button' className='btn btn-default'
						onClick={_ => this.props.cancel()}>Avbryt</button>
				</form>
			</div>
		)
	}

	private async _createPersonAsync(): Promise<void> {
		const fullName = this._addFullName && this._addFullName.value
		const nickname = this._addNickname && this._addNickname.value

		if (!this._selfie) {
			alert('Fotoboks er ikke klar enda.')
			return
		}
		if (!fullName || !nickname) {
			alert('Fyll inn alle felter først.')
			return
		}
		const { photoDataUrl, photoWidth, photoHeight } = this._selfie
		if (!photoDataUrl || !photoWidth || !photoHeight) {
			alert('Ta bilde først.')
			return
		}

		this.props.createPerson({
			fullName,
			nickname,
			jokes: ['Hei kjekken!'],
			photoDataUrl,
			photoHeight,
			photoWidth,
		})

		this._clearAddPersonFields()
	}

	private _clearAddPersonFields() {
		this._clearInputs(this._addFullName, this._addNickname)
	}

	private _clearInputs(...inputs: Array<HTMLInputElement | null>) {
		for (const input of inputs) {
			if (input) { input.value = '' }
		}
	}

	private _onFirstNameChange(firstName: string): any {
		if (!this._addNickname) { console.error('No nickname field, bug?'); return }

		const currentNickname = this._addNickname.value.trim()
		if (currentNickname === '' || currentNickname === this._lastAutoFilledNickname) {
			// Default to first name, unless user typed something else
			this._addNickname.value = firstName
			this._lastAutoFilledNickname = firstName
		}
	}

	private _updateCanAddPerson() {
		const fullName = this._addFullName && this._addFullName.value
		const nickname = this._addNickname && this._addNickname.value
		const hasPhoto: boolean = (this._selfie && this._selfie.photoDataUrl) ? true : false
		const canAddPerson = (fullName && nickname && hasPhoto) ? true : false
		this.setState({ canAddPerson })
	}

}

export default Component
