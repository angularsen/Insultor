// tslint:disable:no-submodule-imports
// import 'bootstrap/dist/css/bootstrap-theme.min.css'
// import 'bootstrap/dist/css/bootstrap.min.css'
// tslint:enable:no-submodule-imports
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
