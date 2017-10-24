import { IVideoService } from '../VideoService'

export class FakeVideoService implements IVideoService {
	public drawCurrentImageOnCanvas(canvas: HTMLCanvasElement): void {
		throw new Error('Method not implemented.')
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
