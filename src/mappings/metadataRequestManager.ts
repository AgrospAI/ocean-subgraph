import { log } from '@graphprotocol/graph-ts'

import { BigInt } from '@graphprotocol/graph-ts'
import {
  RequestApplied,
  RequestCancelled,
  RequestCreated,
  RequestVoted,
  RequestVotingFinished
} from '../@types/MetadataRequestManager/MetadataRequestManager'

import { MetadataRequest, SubRequest, Vote } from '../@types/schema'

export function handleRequestCreated(event: RequestCreated): void {
  // 1. Create the Parent Request
  let requestId = event.params.id.toString()
  let request = new MetadataRequest(requestId)

  request.datasetAddress = event.params.datasetAddress.toHexString()
  request.algorithmAddress = event.params.algorithmAddress.toHexString()
  request.requester = event.params.requester
  request.reason = event.params.reason
  request.status = 0 // Pending
  request.expiresAt = event.params.expiresAt
  request.createdAt = event.block.timestamp

  // Save the parent first so the children can reference it
  request.save()

  // 2. Create the SubRequests
  let types = event.params.requestTypes
  let data = event.params.data

  // Safety check to ensure arrays match (though contract should enforce this)
  for (let i = 0; i < types.length; i++) {
    // Unique ID for each sub-item, e.g., "1-0", "1-1"
    let subRequestId = requestId + '-' + i.toString()
    let subRequest = new SubRequest(subRequestId)

    subRequest.request = requestId // Links back to MetadataRequest
    subRequest.requestType = types[i]
    subRequest.data = data[i]

    // Initialize weights
    subRequest.yesWeight = BigInt.fromI32(0)
    subRequest.noWeight = BigInt.fromI32(0)

    subRequest.save()
  }
}

export function handleRequestVoted(event: RequestVoted): void {
  let requestId = event.params.id.toString()
  let voter = event.params.voter
  let weight = event.params.weight
  let bitmap = event.params.inFavourBitmap

  let voteId =
    requestId +
    '-' +
    event.transaction.hash.toHex() +
    '-' +
    event.logIndex.toString()
  let vote = new Vote(voteId)
  vote.request = requestId
  vote.voter = voter
  vote.inFavourBitmap = bitmap
  vote.weight = weight
  vote.save()

  let bitmapPrimitive = bitmap.toI32()

  for (let i = 0; i < 100; i++) {
    let subRequestId = requestId + '-' + i.toString()
    let subRequest = SubRequest.load(subRequestId)

    // If we can't find the next sub-request, we've reached the end
    if (subRequest == null) break

    // BITMAP LOGIC
    let isYes = (bitmapPrimitive >> subRequest.requestType) & 1

    if (isYes == 1) {
      subRequest.yesWeight = subRequest.yesWeight.plus(weight)
    } else {
      subRequest.noWeight = subRequest.noWeight.plus(weight)
    }

    subRequest.save()
  }
}

export function handleRequestCancelled(event: RequestCancelled): void {
  let request = MetadataRequest.load(event.params.id.toString())
  if (!request) {
    log.warning('MetadataRequest not found for id: {}', [
      event.params.id.toString()
    ])
    return
  }
  request.status = 1 // Cancelled
  request.save()
}

export function handleRequestVotingFinished(
  event: RequestVotingFinished
): void {
  let request = MetadataRequest.load(event.params.id.toString())
  if (!request) {
    log.warning('MetadataRequest not found for id: {}', [
      event.params.id.toString()
    ])
    return
  }
  request.status = event.params.status
  request.save()
}

export function handleRequestApplied(event: RequestApplied): void {
  let request = MetadataRequest.load(event.params.id.toString())
  if (!request) {
    log.warning('MetadataRequest not found for id: {}', [
      event.params.id.toString()
    ])
    return
  }

  request.save()
}
