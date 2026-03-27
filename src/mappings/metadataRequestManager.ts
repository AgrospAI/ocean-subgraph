import { log } from '@graphprotocol/graph-ts'

import { BigInt } from '@graphprotocol/graph-ts'
import {
  RequestApplied,
  RequestCancelled,
  RequestCreated,
  RequestVoted,
  RequestVotingFinished
} from '../@types/MetadataRequestManager/MetadataRequestManager'

import { MetadataRequest, Nft, SubRequest, UserCounter, Vote } from '../@types/schema'

function getOrCreateUserCounter(userAddress: string): UserCounter {
  let counter = UserCounter.load(userAddress)
  
  if (counter == null) {
    counter = new UserCounter(userAddress)
    counter.pendingCount = 0
    counter.totalCount = 0
  }

  return counter
}

export function handleRequestCreated(event: RequestCreated): void {
  let requestId = event.params.id.toString()
  let request = new MetadataRequest(requestId)

  request.datasetAddress = event.params.datasetAddress.toHexString()
  request.algorithmAddress = event.params.algorithmAddress.toHexString()
  request.requester = event.params.requester
  request.reason = event.params.reason
  request.status = 0 // Pending
  request.expiresAt = event.params.expiresAt
  request.createdAt = event.block.timestamp
  request.save()

  // Create the SubRequests
  let types = event.params.requestTypes
  let data = event.params.data

  for (let i = 0; i < types.length; i++) {
    let subRequestId = requestId + '-' + i.toString()
    let subRequest = new SubRequest(subRequestId)

    subRequest.request = requestId // Links back to MetadataRequest
    subRequest.requestType = types[i]
    subRequest.data = data[i]
    subRequest.yesWeight = BigInt.fromI32(0)
    subRequest.noWeight = BigInt.fromI32(0)

    subRequest.save()
  }

  const nft = Nft.load(event.params.datasetAddress.toHexString())
  if (nft !== null) {
    let counter = getOrCreateUserCounter(nft.owner)
    counter.pendingCount += 1
    counter.totalCount += 1
    counter.save()
  }

  let counter = getOrCreateUserCounter(request.requester.toHexString())
  counter.pendingCount += 1
  counter.save()
}

export function handleRequestVoted(event: RequestVoted): void {
  let requestId = event.params.id.toString()
  let voter = event.params.voter
  let data = event.params.data
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
  vote.data = data
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

  const nft = Nft.load(request.datasetAddress)
  if (nft !== null) {
    let counter = getOrCreateUserCounter(nft.owner)
    counter.pendingCount -= 1
    counter.totalCount -= 1
    counter.save()
  }

  let counter = getOrCreateUserCounter(request.requester.toHexString())
  counter.pendingCount -= 1
  counter.save()
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

  const nft = Nft.load(request.datasetAddress)
  if (nft !== null) {
    let counter = getOrCreateUserCounter(nft.owner)
    counter.pendingCount -= 1
    counter.save()
  }

  let counter = getOrCreateUserCounter(request.requester.toHexString())
  counter.pendingCount -= 1
  counter.save()
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
