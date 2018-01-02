import * as React from 'react'
import { NavLink, Route, Switch } from 'react-router-dom'

import About from './About'
import InsultMyFace from './InsultMyFace'
import { faceApiConfig } from './services/constants'
import { DataStore } from './services/DataStore'
import { MicrosoftFaceApi } from './services/MicrosoftFaceApi'
import { SettingsStore } from './services/Settings'
import Settings from './Settings'
import TestBin from './TestBin'

const headerStyle: React.CSSProperties = {
	color: 'rgb(199, 199, 199)',
}

const navBarListStyle: React.CSSProperties = {
	listStyleType: 'none',
	margin: 0,
	padding: 0,
	overflow: 'hidden',
	backgroundColor: '#333',
}

const navBarItemStyleFirst: React.CSSProperties = {
	float: 'left',
	minWidth: '4em',
}

const navBarItemStyle: React.CSSProperties = {
	...navBarItemStyleFirst,
	borderLeft: '2px solid #2b2b2b',
}

const navBarLinkStyle: React.CSSProperties = {
	display: 'block',
	color: headerStyle.color,
	textAlign: 'center',
	padding: '14px 16px',
	textDecoration: 'none',
	fontSize: '1.0em',
}

const navBarLogoLinkStyle: React.CSSProperties = {
	...navBarLinkStyle,
	padding: '5px 0',
}

const navBarLogoStyle: React.CSSProperties = {
	width: 30,
	height: 30,
}

const faceApi = new MicrosoftFaceApi(
	faceApiConfig.myPersonalSubscriptionKey,
	faceApiConfig.endpoint,
	faceApiConfig.webstepPersonGroupId)

const dataStore = new DataStore(faceApi, new SettingsStore())

const activeLinkStyle: React.CSSProperties = { color: 'yellow', fontWeight: 'bold' }

// tslint:disable-next-line:variable-name
const Header: React.StatelessComponent<{}> = () => (
	<header style={headerStyle}>
		<nav>
			<ul style={navBarListStyle}>
				<li style={navBarItemStyleFirst}>
					<NavLink style={navBarLogoLinkStyle} activeStyle={activeLinkStyle} to='/'>
						<img style={navBarLogoStyle} src='img/logo-50p-square-white-trans.png' />
					</NavLink>
				</li>
				<li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/settings'>Innstillinger</NavLink></li>
				<li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/about'>Om</NavLink></li>
				<li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/testbin'>TestBin</NavLink></li>
			</ul>
		</nav>
		<div style={{ clear: 'both' }}></div>
	</header>
)

// tslint:disable-next-line:variable-name
const Main: React.StatelessComponent<{}> = () => (
	<main style={{padding: '0em', backgroundColor: '#f6f6f6', margin: '0 auto', minHeight: '90vh' }}>
		<Switch>
			<Route exact path='/' render={() => (<InsultMyFace dataStore={dataStore} />)}/>
			<Route exact path='/testbin' render={() => (<TestBin dataStore={dataStore} />)}/>
			<Route exact path='/settings' render={(p) => (<Settings dataStore={dataStore} search={p.location.search} />)} />
			<Route path='/about' component={About}/>
		</Switch>
	</main>
)

// tslint:disable-next-line:variable-name
const App: React.StatelessComponent<{}> = () => (
	<div>
		<Header />
		<Main />
	</div>
)

export default App
