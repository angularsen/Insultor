import React from 'react';
import ReactDOM from 'react-dom';
import { Route, Switch } from 'react-router-dom';
import { NavLink } from 'react-router-dom'

import TestBin from './TestBin';
import InsultMyFace from './InsultMyFace';
import About from './About';

const navBarListStyle = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
  overflow: 'hidden',
  backgroundColor: '#333'
};

const navBarItemStyle = {
  float: 'left',
  minWidth: '4em',
  borderRight: '1px solid #999'
};

const navBarLinkStyle = {
  display: 'block',
  color: 'white',
  textAlign: 'center',
  padding: '14px 16px',
  textDecoration: 'none',
  fontSize: '1.0em'
};

const navBarLogoLinkStyle = {
  ...navBarLinkStyle,
  padding: 0
};

const navBarLogoStyle = {
  width: 40,
  height: 40
};

const activeLinkStyle = { color: 'yellow', fontWeight: 'bold' }

const Header = () => (
  <header>
    <nav>
      <ul style={navBarListStyle}>
        <li style={navBarItemStyle}><NavLink style={navBarLogoLinkStyle} activeStyle={activeLinkStyle} to='/'><img style={navBarLogoStyle} src="img/logo-50p-square-white-trans.png" /></NavLink></li>
        <li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/diffcam'>DiffCam</NavLink></li>
        <li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/testbin'>TestBin</NavLink></li>
        <li style={navBarItemStyle}><NavLink style={navBarLinkStyle} activeStyle={activeLinkStyle} to='/about'>About</NavLink></li>
      </ul>
    </nav>
    <div style={{ clear: 'both' }}></div>
  </header>
);

const Main = () => (
  <main style={{padding: '0em', backgroundColor: '#f6f6f6', margin: '0 auto', minHeight: '90vh' }}>
    <Switch>
      <Route exact path='/' component={InsultMyFace}/>
      <Route exact path='/testbin' component={TestBin}/>
      <Route path='/about' component={About}/>
    </Switch>
  </main>
);

const App = () => (
  <div>
    <Header />
    <Main />
  </div>
);

export default App;