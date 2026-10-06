/**
 * Binds sync node ids written before Kora recorded node claims (beta.12 and
 * older servers) to the user who owns the auth device with that id.
 *
 * The creator app uses `createKoraAuthSync`, so a browser's sync node id is its
 * signed-in auth device id and cannot change. After the beta.13 upgrade every
 * node with history has no recorded owner, and the server refuses such a device
 * (`NODE_ID_CLAIMED`) on every reconnect: the device never syncs again and its
 * offline writes never upload. This is the documented procedure
 * (Kora `docs/guide/production-server.md`, "Upgrading a beta.12 server database
 * with authentication"), run at boot so it needs no manual database access.
 *
 * Safe to run on every start: a node that already has an owner is never
 * touched, so a real claim is never replaced. `''` means an administrator
 * released the node, which is bound like an unclaimed one.
 */

export interface NodeClaimStore {
	getNodeIdsAfterDelivery?(afterDeliverySequence: number): Promise<string[]>
	getNodeClaimOwner?(nodeId: string): Promise<string | null>
	releaseNodeClaim?(nodeId: string): Promise<boolean>
	claimNode?(nodeId: string, userId: string): Promise<boolean>
}

export interface DeviceDirectory {
	findDevice(deviceId: string): Promise<{ userId: string } | null>
}

export interface NodeClaimBindingResult {
	/** Node ids with history, excluding the server's own `kora:` nodes. */
	nodes: number
	/** Nodes whose id is an auth device. */
	devices: number
	/** Nodes bound to their device's owner by this run. */
	bound: number
	/** Device nodes that already had an owner (left alone). */
	alreadyClaimed: number
	/** Device nodes that could not be bound (claimNode refused). */
	failed: number
	/** False when the store cannot read or write node claims. */
	supported: boolean
}

export async function bindLegacyDeviceNodeClaims(
	store: NodeClaimStore,
	users: DeviceDirectory,
): Promise<NodeClaimBindingResult> {
	const result: NodeClaimBindingResult = { nodes: 0, devices: 0, bound: 0, alreadyClaimed: 0, failed: 0, supported: true }
	if (!store.getNodeIdsAfterDelivery || !store.getNodeClaimOwner || !store.releaseNodeClaim || !store.claimNode) {
		return { ...result, supported: false }
	}
	for (const nodeId of await store.getNodeIdsAfterDelivery(0)) {
		if (nodeId.startsWith('kora:')) continue
		result.nodes += 1
		const device = await users.findDevice(nodeId)
		if (!device?.userId) continue
		result.devices += 1
		if (await store.getNodeClaimOwner(nodeId)) {
			result.alreadyClaimed += 1
			continue
		}
		await store.releaseNodeClaim(nodeId)
		if (await store.claimNode(nodeId, device.userId)) result.bound += 1
		else result.failed += 1
	}
	return result
}
