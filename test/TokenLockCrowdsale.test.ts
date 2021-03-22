// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { advanceBlock, duration, increaseTo, latest } from './utils/time'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'

describe('TokenLockCrowdsale', function () {
  const rate = 50000
  const cap = expandTo18Decimals(40000000)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const tokenSupply = expandTo18Decimals(200000000)
  const value = expandTo18Decimals(5)
  const valueYacs = value.mul(rate)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))

  let wallet: Signer
  let beneficiary: Signer
  let purchaser: Signer
  let beneficiaryAddress: string
  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let openingTime: BigNumber
  let closingTime: BigNumber
  let afterClosingTime: BigNumber
  let additionalLockPeriod: BigNumber
  let afterLockedTime: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()
    ;[wallet, beneficiary, purchaser] = await ethers.getSigners()

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()
  })

  beforeEach(async function () {
    const walletAddress = await wallet.getAddress()
    beneficiaryAddress = await beneficiary.getAddress()

    openingTime = (await latest()).add(duration.weeks(1))
    closingTime = openingTime.add(duration.weeks(1))
    afterClosingTime = closingTime.add(duration.seconds(1))
    additionalLockPeriod = duration.weeks(60)
    afterLockedTime = closingTime.add(additionalLockPeriod).add(duration.seconds(1))

    const yacoobaCrowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
    crowdsale = (await yacoobaCrowdsale.deploy(
      rate,
      walletAddress,
      yac.address,
      cap,
      beneficiaryMinCapYACs,
      beneficiaryHardCapYACs,
      walletAddress,
      openingTime,
      closingTime,
      additionalLockPeriod,
    )) as YacoobaCrowdsale
    await crowdsale.deployed()
    await yac.mint(walletAddress, tokenSupply)
    await yac.connect(wallet).increaseAllowance(crowdsale.address, tokenSupply)
    await crowdsale.grantRole(BENEFICIARY_ROLE, beneficiaryAddress)
  })

  context('After opening time', function () {
    beforeEach(async function () {
      await increaseTo(openingTime.add(duration.seconds(1)))
    })

    context('with bought tokens', function () {
      beforeEach(async function () {
        await crowdsale.connect(purchaser).buyTokens(beneficiaryAddress, { value })
      })

      it('Should not immediately assign tokens to beneficiaries', async () => {
        expect(await crowdsale.lockingTime()).to.equal(closingTime.add(additionalLockPeriod))
        expect(await crowdsale.balanceOf(beneficiaryAddress)).to.equal(valueYacs)
        expect(await yac.balanceOf(beneficiaryAddress)).to.be.equal(0)
      })

      it('Should fail when beneficiaries try to withdraw tokens before crowdsale ends', async () => {
        await expect(crowdsale.withdrawTokens(beneficiaryAddress)).to.be.revertedWith('TLC: crowdsale not closed')
      })

      context('After closing time', function () {
        beforeEach(async function () {
          await increaseTo(afterClosingTime)
        })

        it('Should fail when beneficiaries try to withdraw tokens after crowdsale ends and before locked period', async () => {
          await expect(crowdsale.withdrawTokens(beneficiaryAddress)).to.be.revertedWith('TLC: tokens are still locked')
        })
      })

      context('After locked time', function () {
        beforeEach(async function () {
          await increaseTo(afterLockedTime)
        })

        it('Should allow beneficiaries to withdraw tokens', async () => {
          await crowdsale.withdrawTokens(beneficiaryAddress)
          expect(await crowdsale.balanceOf(beneficiaryAddress)).to.be.equal(0)
          expect(await yac.balanceOf(beneficiaryAddress)).to.be.equal(valueYacs)
        })

        it('Should reject multiple withdrawals', async () => {
          await crowdsale.withdrawTokens(beneficiaryAddress)
          await expect(crowdsale.withdrawTokens(beneficiaryAddress)).to.be.revertedWith(
            'TLC: beneficiary is not due any tokens',
          )
        })
      })
    })
  })
})
