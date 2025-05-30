export interface StreamOptions {
	/** number of concurrent transfers */
	transferCount?: number;
	/**
	 * size of each transfer.
	 * should be multiple of packet size to avoid overflow
	 */
	transferBufferSize?: number;
}
