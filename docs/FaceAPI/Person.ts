export interface Person {
	personId: AAGUID
	persistedFaceIds: AAGUID[]
	name: string
	userData: string
}

export default Person
