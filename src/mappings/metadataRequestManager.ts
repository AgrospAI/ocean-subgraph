import { log } from '@graphprotocol/graph-ts'
import {
  RequestApplied,
  RequestCancelled,
  RequestCreated,
  RequestVoted,
  RequestVotingFinished
} from '../@types/MetadataRequestManager'
import { MetadataRequest, Vote } from '../@types/schema'

export function handleRequestCreated(event: RequestCreated): void {
  let request = new MetadataRequest(event.params.id.toString())
  request.erc721 = event.params.erc721
  request.did = event.params.did
  request.requester = event.params.requester
  request.status = 0 // Pending
  request.expiresAt = event.params.expiresAt
  request.createdAt = event.block.timestamp
  request.save()
}

export function handleRequestVoted(event: RequestVoted): void {
  let id =
    event.params.id.toString() +
    '-' +
    event.transaction.hash.toHex() +
    '-' +
    event.logIndex.toString()
  let vote = new Vote(id)
  vote.request = event.params.id.toString()
  vote.voter = event.params.voter
  vote.approved = event.params.approved
  vote.weight = event.params.weight
  vote.save()
}

export function handleRequestCancelled(event: RequestCancelled): void {
  let request = MetadataRequest.load(event.params.id.toString())
  if (!request) {
    log.warning('MetadataRequest not found for id: {}', [
      event.params.id.toString()
    ])
    return
  }
  request.status = 4 // Cancelled
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
  // status already set by handleRequestVotingFinished
  // just save the applied data if you have those fields in your schema
  request.save()
}
