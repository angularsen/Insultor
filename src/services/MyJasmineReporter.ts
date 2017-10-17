import {} from 'jasmine'

const finalReport: { logs: any[], stats: any, totalSpecs: number } = {
	logs: [],
	stats: {},
	totalSpecs: 0,
}

export function create() {
	const reporter: any = {}

	const log = (str: string) => {
		console.log(str)
		finalReport.logs.push(str)
	}

	reporter.jasmineStarted = (suiteInfo: any) => {
		log('Running ' + suiteInfo.totalSpecsDefined + ' specs...')
		finalReport.totalSpecs = suiteInfo.totalSpecsDefined
	}

	reporter.suiteStarted = (result: any) => {
		log(`RUN SUITE: ${result.description}`)
	}

	reporter.specStarted = (result: any) => {
		log('')
		log(`SPEC: ${result.description}`)
		log(`---`)
	}

	reporter.specDone = (result: any) => {
		finalReport.stats[result.status] = finalReport.stats[result.status] || 0
		finalReport.stats[result.status] += 1

		log('=> ' + result.status)
		for (const failedExpectation of result.failedExpectations) {
			log('Failure: ' + failedExpectation.message)
			log(failedExpectation.stack)
		}
	}

	// not useful:
	// reporter.suiteDone = (result: any) => {
	//  log('=> ' + result.status)
	//  for(var i = 0 i < result.failedExpectations.length i++) {
	//    log('AfterAll ' + result.failedExpectations[i].message)
	//    log(result.failedExpectations[i].stack)
	//  }
	// }

	reporter.jasmineDone = () => {
		console.log('')

		let finalOutput = finalReport.totalSpecs + ' examples'

		Object.keys(finalReport.stats).forEach((specStatus) => {
			finalOutput += ', ' + finalReport.stats[specStatus] + ' ' + specStatus
		})

		log(finalOutput)
	}

	return reporter
}

function extend(destination: any, source: any) {
	for (const property in source) {
		if (source.hasOwnProperty(property)) {
			destination[property] = source[property]
		}
	}
	return destination
}

// Define Jasmine and attach globally
// const jasmine = jasmineRequire.core(jasmineRequire)
// jasmine.getEnv().addReporter(myReporter())
// var jasmineInterface = jasmineRequire.interface(jasmine, jasmine.getEnv())
// extend(this, jasmineInterface)
export default { create }