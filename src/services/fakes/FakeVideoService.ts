import { IVideoService } from '../VideoService'

export class FakeVideoService implements IVideoService {
	constructor() {
		console.log('FakeVideoService.ctor()')
	}
	public getCurrentImageDataUrl() {
		return 'Fake image data URL'
	}
	public start(): void {
		console.log('FakeVideoService: Start video.')
	}
	public stop(): void {
		console.log('FakeVideoService: Stop video.')
	}
}

export default FakeVideoService
