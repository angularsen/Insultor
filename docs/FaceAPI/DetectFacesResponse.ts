export interface FaceRectangle {
	width: number
	height: number
	left: number
	top: number
}

export interface PupilLeft {
	x: number
	y: number
}

export interface PupilRight {
	x: number
	y: number
}

export interface NoseTip {
	x: number
	y: number
}

export interface MouthLeft {
	x: number
	y: number
}

export interface MouthRight {
	x: number
	y: number
}

export interface EyebrowLeftOuter {
	x: number
	y: number
}

export interface EyebrowLeftInner {
	x: number
	y: number
}

export interface EyeLeftOuter {
	x: number
	y: number
}

export interface EyeLeftTop {
	x: number
	y: number
}

export interface EyeLeftBottom {
	x: number
	y: number
}

export interface EyeLeftInner {
	x: number
	y: number
}

export interface EyebrowRightInner {
	x: number
	y: number
}

export interface EyebrowRightOuter {
	x: number
	y: number
}

export interface EyeRightInner {
	x: number
	y: number
}

export interface EyeRightTop {
	x: number
	y: number
}

export interface EyeRightBottom {
	x: number
	y: number
}

export interface EyeRightOuter {
	x: number
	y: number
}

export interface NoseRootLeft {
	x: number
	y: number
}

export interface NoseRootRight {
	x: number
	y: number
}

export interface NoseLeftAlarTop {
	x: number
	y: number
}

export interface NoseRightAlarTop {
	x: number
	y: number
}

export interface NoseLeftAlarOutTip {
	x: number
	y: number
}

export interface NoseRightAlarOutTip {
	x: number
	y: number
}

export interface UpperLipTop {
	x: number
	y: number
}

export interface UpperLipBottom {
	x: number
	y: number
}

export interface UnderLipTop {
	x: number
	y: number
}

export interface UnderLipBottom {
	x: number
	y: number
}

export interface FaceLandmarks {
	pupilLeft: PupilLeft
	pupilRight: PupilRight
	noseTip: NoseTip
	mouthLeft: MouthLeft
	mouthRight: MouthRight
	eyebrowLeftOuter: EyebrowLeftOuter
	eyebrowLeftInner: EyebrowLeftInner
	eyeLeftOuter: EyeLeftOuter
	eyeLeftTop: EyeLeftTop
	eyeLeftBottom: EyeLeftBottom
	eyeLeftInner: EyeLeftInner
	eyebrowRightInner: EyebrowRightInner
	eyebrowRightOuter: EyebrowRightOuter
	eyeRightInner: EyeRightInner
	eyeRightTop: EyeRightTop
	eyeRightBottom: EyeRightBottom
	eyeRightOuter: EyeRightOuter
	noseRootLeft: NoseRootLeft
	noseRootRight: NoseRootRight
	noseLeftAlarTop: NoseLeftAlarTop
	noseRightAlarTop: NoseRightAlarTop
	noseLeftAlarOutTip: NoseLeftAlarOutTip
	noseRightAlarOutTip: NoseRightAlarOutTip
	upperLipTop: UpperLipTop
	upperLipBottom: UpperLipBottom
	underLipTop: UnderLipTop
	underLipBottom: UnderLipBottom
}

export interface FacialHair {
	moustache: number
	beard: number
	sideburns: number
}

export interface FaceAttributes {
	age: number
	gender: string
	smile: number
	facialHair: FacialHair
}

export interface HeadPose {
	roll: number
	yaw: number
	pitch: number
}

export interface Emotion {
	anger: number
	contempt: number
	disgust: number
	fear: number
	happiness: number
	neutral: number
	sadness: number
	surprise: number
}

export interface HairColor {
	color: string
	confidence: number
}

export interface Hair {
	bald: number
	invisible: boolean
	hairColor: HairColor[]
}

export interface Makeup {
	eyeMakeup: boolean
	lipMakeup: boolean
}

export interface Occlusion {
	foreheadOccluded: boolean
	eyeOccluded: boolean
	mouthOccluded: boolean
}

export interface Accessory {
	type: string
	confidence?: number
}

export interface Blur {
	blurLevel: string
	value: number
}

export interface Exposure {
	exposureLevel: string
	value: number
}

export interface Noise {
	noiseLevel: string
	value: number
}

export interface DetectFaceResult {
	faceId: string
	faceRectangle: FaceRectangle
	faceLandmarks: FaceLandmarks
	faceAttributes: FaceAttributes
	glasses: string
	headPose: HeadPose
	emotion: Emotion
	hair: Hair
	makeup: Makeup
	occlusion: Occlusion
	accessories: Accessory[]
	blur: Blur
	exposure: Exposure
	noise: Noise
}

/**
	* Generated from \docs\FaceAPI\face_detect_res.json using json2ts.com:
	*/
export type DetectFacesResponse = DetectFaceResult[]

/**
	* Generated from \docs\FaceAPI\face_detect_res.json using json2ts.com:
	*/
export default DetectFacesResponse
