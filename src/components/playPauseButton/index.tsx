import * as React from 'react'

interface Props {
	canStart: boolean
	onStart(event: React.MouseEvent<HTMLButtonElement>): void
	onStop(event: React.MouseEvent<HTMLButtonElement>): void
}

export default function render(props: Props) {
	return props.canStart ? (
		<div style={{ position: 'absolute', display: 'flex', width: '100%', height: '100%' }}>
			<button
				className='btn btn-primary btn-lg'
				style={{ margin: 'auto' }}
				type='button' role='button'
				onClick={props.onStart}
			><img style={{ width: 50, height: 50 }} src='img/logo-50p-square-white-trans.png' /> Start</button>
		</div>
	)
		: (
			<div style={{ position: 'relative' }}>
				<button
					className='btn btn-outline-secondary'
					style={{ position: 'absolute', top: '.5em', right: '.5em' }}
					type='button' role='button'
					onClick={props.onStop}
				>■</button>
			</div>
		)
}
