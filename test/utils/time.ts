import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

/**
 * Advance one block at a time
 */
export async function advanceBlock(): Promise<void> {
  await ethers.provider.send('evm_mine', [])
}

/**
 * Advance the block to the passed height
 * @param target
 */
export async function advanceBlockTo(target: BigNumber): Promise<void> {
  if (!BigNumber.isBigNumber(target)) {
    target = BigNumber.from(target)
  }

  const currentBlock = await latestBlock()
  const start = Date.now()
  let notified
  if (target.lt(currentBlock)) throw Error(`Target block #(${target}) is lower than current block #(${currentBlock})`)
  while ((await latestBlock()).lt(target)) {
    if (!notified && Date.now() - start >= 5000) {
      notified = true
      console.log('WARN: advanceBlockTo: Advancing too many blocks is causing this test to be slow.')
    }
    await advanceBlock()
  }
}

/**
 * @returns time of the last mined block in seconds
 */
export async function latest(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock('latest')
  return BigNumber.from(block.timestamp)
}

/**
 * @returns number of the last mined block
 */
export async function latestBlock(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock('latest')
  return BigNumber.from(block.number)
}

/**
 * Increases time by the passed duration in seconds
 * @param duration time in seconds
 */
export async function increase(duration: BigNumber): Promise<void> {
  if (!BigNumber.isBigNumber(duration)) {
    duration = BigNumber.from(duration)
  }

  if (duration.isNegative()) throw Error(`Cannot increase time by a negative amount (${duration})`)
  await ethers.provider.send('evm_increaseTime', [duration.toNumber()])

  await advanceBlock()
}

/**
 * Beware that due to the need of calling two separate ganache methods and rpc calls overhead
 * it's hard to increase time precisely to a target point so design your test to tolerate
 * small fluctuations from time to time.
 *
 * @param target time in seconds
 */
export async function increaseTo(target: BigNumber): Promise<void> {
  if (!BigNumber.isBigNumber(target)) {
    target = BigNumber.from(target)
  }

  const now = await latest()

  if (target.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`)
  const diff = target.sub(now)
  return increase(diff)
}

export const duration = {
  seconds: (val: number): BigNumber => {
    return BigNumber.from(val)
  },
  minutes: (val: number): BigNumber => {
    return BigNumber.from(val).mul(duration.seconds(60))
  },
  hours: (val: number): BigNumber => {
    return BigNumber.from(val).mul(duration.minutes(60))
  },
  days: (val: number): BigNumber => {
    return BigNumber.from(val).mul(duration.hours(24))
  },
  weeks: (val: number): BigNumber => {
    return BigNumber.from(val).mul(duration.days(7))
  },
  years: (val: number): BigNumber => {
    return BigNumber.from(val).mul(duration.days(365))
  },
}
