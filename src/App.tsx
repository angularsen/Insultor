import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { NavLink, Route, Switch } from 'react-router-dom'

import About from './About'
import InsultMyFace from './InsultMyFace'
import TestBin from './TestBin'

const navBarListStyle: React.CSSProperties = {
	listStyleType: 'none',
	margin: 0,
	padding: 0,
	overflow: 'hidden',
	backgroundColor: '#333',
}

const navBarItemStyle: React.CSSProperties = {
	float: 'left',
	minWidth: '4em',
	borderRight: '1px solid #999',
}

const navBarLinkStyle: React.CSSProperties = {
	display: 'block',
	color: 'white',
	textAlign: 'center',
	padding: '14px 16px',
	textDecoration: 'none',
	fontSize: '1.0em',
}

const navBarLogoLinkStyle: React.CSSProperties = {
	...navBarLinkStyle,
	padding: 0,
}

const navBarLogoStyle: React.CSSProperties = {
	width: 40,
	height: 40,
}

const activeLinkStyle: React.CSSProperties = { color: 'yellow', fontWeight: 'bold' }

// tslint:disable-next-line:variable-name
const Header: React.StatelessComponent<{}> = () => (
	<header>
		<nav>
			<ul style={navBarListStyle}>
				<li style={navBarItemStyle}>
					<NavLink style={navBarLogoLinkStyle} activeStyle={activeLinkStyle} to='/'>
						<img style={navBarLogoStyle} src='img/logo-50p-square-white-trans.png' /></NavLink></li>
				<li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/testbin'>TestBin</NavLink></li>
				<li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/about'>About</NavLink></li>
			</ul>
		</nav>
		<div style={{ clear: 'both' }}></div>
	</header>
)

// tslint:disable-next-line:variable-name
const Main: React.StatelessComponent<{}> = () => (
	<main style={{padding: '0em', backgroundColor: '#f6f6f6', margin: '0 auto', minHeight: '90vh' }}>
		<Switch>
			<Route exact path='/' component={InsultMyFace}/>
			<Route exact path='/testbin' component={TestBin}/>
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
