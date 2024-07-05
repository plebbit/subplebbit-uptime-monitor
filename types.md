{
	ipfsGateways: []
	pubsubProviders: []
	plebbitPreviewers: []
	ethChainProviders: []
	solChainProviders: []
	subplebbits: SubplebbitStatus[]
	nftCollections: []
	ensWebsites: []
}

SubplebbitStatus {
	address: string
	lastSubplebbitUpdateTimestamp: number
	ipnsDhtPeers: Multiaddresses[]
	lastSubplebbitPubsubMessageTimestamp: number
	pubsubPeers: Multiaddresses[]
	pubsubDhtPeers: Multiaddresses[]
}

IpfsGatewayStatus {
    url: string
    lastCommentFetchTime: number
    lastCommentFetchTimestamp: number
    lastCommentFetchAttemptTimestamp: number
    lastCommentFetchSuccess: bool
    commentFetchSuccessRate1h: number
    commentFetchSuccessRate6h: number
    commentFetchSuccessRate24h: number
    commentFetchAverageTime1h: number
    commentFetchAverageTime6h: number
    commentFetchAverageTime24h: number
    commentFetchMedianTime1h: number
    commentFetchMedianTime6h: number
    commentFetchMedianTime24h: number
}
