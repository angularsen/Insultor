export default interface PersonGroupTrainingStatus {
	/** Current status of training */
	status: 'notstarted' | 'running' | 'succeeded' | 'failed',
	/** Person group created time. */
	createdDateTime: string,
	/** Last trained time, or null. */
	lastActionDateTime: string | null,
	/** Error message on failed */
	message: string | null
}