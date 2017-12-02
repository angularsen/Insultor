import * as React from 'react'

export default function render() {
	return (
			<div className='container'>
				<div className='row'>
					<div className='col'>
					<h1 className='display-4'>Litt om</h1>

					{/* Spacer */}
					<div style={{ height: '3em', width: '100%' }}></div>

					<blockquote className='blockquote'>
						<p className='mb-0'>
								Delivers insults to your face<br />based on your face
						</p>
						<footer className='blockquote-footer' style={{marginTop: '1em'}}>Kildekode <cite title='link til github'>
								<a href='https://github.com/angularsen/insultor' target='_blank'>https://github.com/angularsen/insultor</a>
						</cite></footer>
					</blockquote>
				</div>
			</div>
		</div>
	)
}
