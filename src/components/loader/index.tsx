import * as React from 'react'

import * as Styles from './styles.css'

export default function render() {
	return (
		<div style={{ position: 'relative' }}>
			<div className={Styles.loader}></div>
		</div>
	)
}
