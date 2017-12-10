import * as React from 'react'
import { PersonSettings } from '../services/Settings'

interface Props {
	person: PersonSettings
	savePerson(person: PersonSettings): void
}

interface State { person: PersonSettings }

class PersonEditor extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props)

		this.state = {
			person: { ...{}, ...props.person }, // copy person
		}
	}

	public render() {
		const { person } = this.state
		// Keep changes in a copy until user decides to save
		// const personCopy = { ...{}, ...person }

		// Add empty joke to show a new field to type into
		// personCopy.jokes.push('')

		return (
			<form style={{marginTop: '1em'}}>
				{this._renderJokeEditors(person.jokes)}
				<div className='form-group' style={{marginTop: '1em'}}>
					<button type='button' role='button' className='btn btn-primary' onClick={_ => { this.props.savePerson(person) }}>Lagre</button>
					<button type='button' role='button' className='btn btn-default' onClick={_ => this._addJoke()}>Legg til</button>
				</div>
			</form>
		)
	}

	private _renderJokeEditors(jokes: string[]) {
		return jokes.map((joke, idx) => {
			const autoFocus = idx === jokes.length - 1
			return (
				<div className='input-group' key={idx}>
					<span className='input-group-btn'>
						<button className='btn btn-sm btn-default' type='button' onClick={_ => this._removeJoke(idx)}>X</button>
					</span>
					<input type='text' className='form-control' placeholder='Skriv en kommentar'
						defaultValue={joke}
						onChange={ev => jokes[idx] = ev.target.value}
						autoFocus={autoFocus} />
				</div>
			)
		})
	}

	private _addJoke() {
		const personCopy = { ...{}, ...this.state.person }
		personCopy.jokes.push('')

		this.setState({ person: personCopy })
	}

	private _removeJoke(idx: number) {
		const personCopy = { ...{}, ...this.state.person }
		personCopy.jokes.splice(idx, 1)

		this.setState({ person: personCopy })
	}
}

export default PersonEditor
