import * as React from 'react'
import { min } from 'underscore'
import { PersonSettings } from '../services/Settings'
import PersonEditor from './PersonEditor'

interface Props {
	persons: PersonSettings[]
	deletePerson(personId: AAGUID): void
	savePerson(person: PersonSettings): void
}

interface State {
	showEditorForPersonId?: AAGUID
}

function renderJoke(joke: string, jokeIdx: number) {
	return (<li key={jokeIdx.toString()}>{joke}</li>)
}

class PersonList extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props)

		this.state = {
			showEditorForPersonId: undefined,
		}
	}

	public render() {
		const { persons } = this.props
		const { showEditorForPersonId } = this.state

		if (!persons || persons.length === 0) {
			return (<div>Ingen personer lastet..</div>)
		}

		return (
			<div>
				{persons.map(p => this._renderPerson(p, showEditorForPersonId === p.personId))}
			</div>
		)
	}

	private _renderPerson(p: PersonSettings, showEditor: boolean) {
		const { personId } = p

		// Set to undefined to close the editor on Close button click
		// const showHideEditorPersonId = showEditor ? undefined : personId
		// const showHideEditorButtonText = showEditor ? 'Lukk' : 'Endre'

		return (
			<div key={personId} className='card' style={{ width: '21rem' }}>

				<div style={{ display: 'flex' }}>
					<img className='border' style={{ width: '5em', alignSelf: 'baseline' }}
						src={min(p.photos, photo => photo.width).url} alt='Person photo' />
					<div className='' style={{ padding: '.5em' }}>
						<h5 className='card-title'>{p.name}</h5>
						<p className='text-muted'><small style={{ fontSize: '50%' }}>{personId}</small></p>
					</div>
				</div>

				<div className='card-body' style={{ fontSize: '.7em' }}>
					<ul style={{ listStyle: 'none', paddingLeft: 0 }}>{p.jokes.map(renderJoke)} </ul>
					{showEditor
						? (<button className='btn btn-default'
							onClick={_ => this.setState({ showEditorForPersonId: undefined })}>{'Lukk'}</button>)
						: (<button className='btn btn-primary'
							onClick={_ => this.setState({ showEditorForPersonId: personId })}>{'Endre'}</button>)}

					<button className='btn btn-danger' onClick={_ => this.props.deletePerson(personId)}>Slett</button>

					{showEditor
						? (<PersonEditor person={p} savePerson={person => this.props.savePerson(person)} />)
						: undefined}
				</div>
			</div>
		)
	}

}
export default PersonList
