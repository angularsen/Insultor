import * as React from 'react'
import { min } from 'underscore'
import { PersonSettings } from '../services/Settings'

interface Props {
	persons: PersonSettings[]
}

function renderJoke(joke: string, jokeIdx: number) {
	return (<li key={jokeIdx.toString()}>{joke}</li>)
}

function renderPerson(p: PersonSettings) {
	return (
		<div key={p.personId} className='card' style={{ width: '21rem' }}>

			<div style={{ display: 'flex' }}>
				<img className='border' style={{ width: '5em', alignSelf: 'baseline' }}
					src={min(p.photos, photo => photo.width).url} alt='Person photo' />
				<div className='' style={{ padding: '.5em' }}>
					<h5 className='card-title'>{p.name}</h5>
					<p className='text-muted'><small style={{ fontSize: '50%' }}>{p.personId}</small></p>
				</div>
			</div>

			<div className='card-body' style={{ fontSize: '.7em' }}>
				<ul style={{ listStyle: 'none', paddingLeft: 0 }}>{p.jokes.map(renderJoke)} </ul>
				<a href='#' className='btn btn-primary'>Endre</a>
			</div>

		</div>
	)
}

export default function render(props: Props) {
	if (!props.persons || props.persons.length === 0) {
		return (<div>Ingen personer lastet..</div>)
	}

	const persons = props.persons

	return (
		<div>
			{persons.map(renderPerson)}
		</div>
	)
}
