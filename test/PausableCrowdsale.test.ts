// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import { advanceBlock, duration, increaseTo, latest } from './utils/time'

describe('PausableCrowdsale', function () {
  const rate = 50000
  const cap = expandTo18Decimals(40000000)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const lessThanCap = expandTo18Decimals(250000 / rate)
  const tokenSupply = expandTo18Decimals(200000000)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))
  const additionalLockPeriod = 100

  let pauser: Signer
  let wallet: Signer
  let other: Signer
  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let openingTime: BigNumber
  let closingTime: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()
    ;[pauser, wallet, other] = await ethers.getSigners()

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()
  })

  beforeEach(async function () {
    const walletAddress = await wallet.getAddress()
    const otherAddress = await other.getAddress()
    openingTime = (await latest()).add(duration.weeks(1))
    closingTime = openingTime.add(duration.weeks(1))

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
    await crowdsale.grantRole(BENEFICIARY_ROLE, otherAddress)
    await increaseTo(openingTime.add(duration.seconds(1)))
  })

  async function purchaseShouldSucceed(beneficiary: Signer, value: BigNumber) {
    const beneficiaryAddress = await beneficiary.getAddress()
    await crowdsale.connect(beneficiary).buyTokens(beneficiaryAddress, { value })
    await beneficiary.sendTransaction({ to: crowdsale.address, value })
  }

  async function purchaseExpectRevert(beneficiary: Signer, value: BigNumber) {
    const beneficiaryAddress = await beneficiary.getAddress()
    await expect(crowdsale.connect(beneficiary).buyTokens(beneficiaryAddress, { value })).to.be.revertedWith(
      'Pausable: paused',
    )
    await expect(beneficiary.sendTransaction({ to: crowdsale.address, value })).to.be.revertedWith('Pausable: paused')
  }

  it('Should be able to purchases tokens', async function () {
    await purchaseShouldSucceed(other, lessThanCap)
  })

  context('after pause', function () {
    beforeEach(async function () {
      await crowdsale.connect(pauser).pause()
    })

    it('Should fail to purchase tokens if crowdsale is paused', async function () {
      await purchaseExpectRevert(other, lessThanCap)
    })

    context('after unpause', function () {
      beforeEach(async function () {
        await crowdsale.connect(pauser).unpause()
      })

      it('Should be able to purchases tokens', async function () {
        await purchaseShouldSucceed(other, lessThanCap)
      })
    })
  })
})
