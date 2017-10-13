import React from 'react';
import ReactDOM from 'react-dom';
import { Link, Route, Switch } from 'react-router-dom';

import Home from './Home';
import DiffCam from './DiffCam';
import IdentifyOnPresence from './IdentifyOnPresence';
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
  minWidth: '8em',
  borderRight: '1px solid #999'
};

const navBarLinkStyle = {
  display: 'block',
  color: 'white',
  textAlign: 'center',
  padding: '14px 16px',
  textDecoration: 'none',
  fontSize: '1.2em'
};

const navBarLogoLinkStyle = {
  ...navBarLinkStyle,
  padding: 0
};

const navBarLogoStyle = {
  width: 50,
  height: 50
};

const Header = () => (
  <header>
    <nav>
      <ul style={navBarListStyle}>
        <li style={navBarItemStyle}><Link style={navBarLogoLinkStyle} to='/'><img style={navBarLogoStyle} src="img/logo-50p-square-white-trans.png" /></Link></li>
        <li style={navBarItemStyle}><Link style={navBarLinkStyle} to='/diffcam'>DiffCam</Link></li>
        <li style={navBarItemStyle}><Link style={navBarLinkStyle} to='/identify-on-presence'>Identify on Presence</Link></li>
        <li style={navBarItemStyle}><Link style={navBarLinkStyle} to='/about'>About</Link></li>
      </ul>
    </nav>
    <div style={{ clear: 'both' }}></div>
  </header>
);

const Main = () => (
  <main style={{padding: '.5em', backgroundColor: '#f6f6f6', margin: '0 auto', minHeight: '90vh' }}>
    <Switch>
      <Route exact path='/' component={Home}/>
      <Route exact path='/diffcam' component={DiffCam}/>
      <Route exact path='/identify-on-presence' component={IdentifyOnPresence}/>
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