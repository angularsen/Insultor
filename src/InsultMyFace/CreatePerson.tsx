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
	private _addFirstName: HTMLInputElement | null // Option<HTMLInputElement>
	private _addLastName: HTMLInputElement | null // Option<HTMLInputElement>
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
						<label htmlFor='addFirstName'>Fornavn</label>
						<input id='addFirstName' type='text' className='form-control' placeholder='Eks: Ola'
							onChange={ev => { this._onFirstNameChange(ev.target.value); this._updateCanAddPerson() }}
							ref={(x) => { this._addFirstName = x/*Option.from(x)*/ }} />
					</div>

					<div className='form-group'>
						<label htmlFor='addLastName'>Etternavn</label>
						<input id='addLastName' type='text' className='form-control' placeholder='Eks: Nordmann'
							onChange={_ => { this._updateCanAddPerson() }}
							ref={(x) => this._addLastName = x/*Option.from(x)*/} />
					</div>

					<div className='form-group'>
						<label htmlFor='addNickname'>Kallenavn</label>
						<input id='addNickname' type='text' className='form-control' placeholder='Eks: Ebola'
							onChange={_ => { this._updateCanAddPerson() }}
							ref={(x) => this._addNickname = x/*Option.from(x)*/} />
					</div>

					<button type='button' className='btn btn-primary'
						onClick={_ => this._createPersonAsync()} disabled={!this.state.canAddPerson}>Opprett person</button>
				</form>
			</div>
		)
	}

	private async _createPersonAsync(): Promise<void> {
		const firstName = this._addFirstName && this._addFirstName.value
		const lastName = this._addLastName && this._addLastName.value
		const nickname = this._addNickname && this._addNickname.value

		if (!this._selfie) {
			alert('Fotoboks er ikke klar enda.')
			return
		}
		if (!firstName || !lastName || !nickname) {
			alert('Fyll inn alle felter først.')
			return
		}
		const { photoDataUrl, photoWidth, photoHeight } = this._selfie
		if (!photoDataUrl || !photoWidth || !photoHeight) {
			alert('Ta bilde først.')
			return
		}

		this.props.createPerson({
			firstName,
			jokes: ['Hei kjekken!'],
			lastName,
			nickname,
			photoDataUrl,
			photoHeight,
			photoWidth,
		})

		this._clearAddPersonFields()
	}

	private _clearAddPersonFields() {
		this._clearInputs(this._addFirstName, this._addLastName, this._addNickname)
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
		const firstName = this._addFirstName && this._addFirstName.value
		const lastName = this._addLastName && this._addLastName.value
		const nickname = this._addNickname && this._addNickname.value
		const hasPhoto: boolean = (this._selfie && this._selfie.photoDataUrl) ? true : false
		const canAddPerson = (firstName && lastName && nickname && hasPhoto) ? true : false
		this.setState({ canAddPerson })
	}

}

export default Component
