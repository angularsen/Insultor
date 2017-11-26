// tslint:disable-next-line:no-submodule-imports
import 'bootstrap/dist/css/bootstrap.css'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { HashRouter } from 'react-router-dom'

import App from './App'

document.addEventListener('DOMContentLoaded', () => {
	ReactDOM.render((
		<HashRouter>
			<App />
		</HashRouter>
	), document.getElementById('mount'))
})
