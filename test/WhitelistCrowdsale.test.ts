// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import { advanceBlock, duration, increaseTo, latest } from './utils/time'

describe('WhitelistCrowdsale', function () {
  const rate = 50000
  const cap = expandTo18Decimals(40000000)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const value = expandTo18Decimals(5)
  const tokenSupply = expandTo18Decimals(200000000)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))
  const additionalLockPeriod = 100

  let owner: Signer
  let notWhitelisted: Signer
  let whitelisted: Signer
  let secondWhitelisted: Signer
  let thirdWhitelisted: Signer
  let fourthWhitelisted: Signer
  let fifthWhitelisted: Signer
  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let openingTime: BigNumber
  let closingTime: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()
    ;[
      owner,
      notWhitelisted,
      whitelisted,
      secondWhitelisted,
      thirdWhitelisted,
      fourthWhitelisted,
      fifthWhitelisted,
    ] = await ethers.getSigners()
    const ownerAddress = await owner.getAddress()

    openingTime = (await latest()).add(duration.weeks(1))
    closingTime = openingTime.add(duration.weeks(1))

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()

    const yacoobaCrowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
    crowdsale = (await yacoobaCrowdsale.deploy(
      rate,
      ownerAddress,
      yac.address,
      cap,
      beneficiaryMinCapYACs,
      beneficiaryHardCapYACs,
      ownerAddress,
      openingTime,
      closingTime,
      additionalLockPeriod,
    )) as YacoobaCrowdsale
    await crowdsale.deployed()
    await yac.mint(ownerAddress, tokenSupply)
    await yac.connect(owner).increaseAllowance(crowdsale.address, tokenSupply)
  })

  async function purchaseShouldSucceed(beneficiary: Signer, value: BigNumber) {
    const beneficiaryAddress = await beneficiary.getAddress()
    await crowdsale.connect(beneficiary).buyTokens(beneficiaryAddress, { value })
    await beneficiary.sendTransaction({ to: crowdsale.address, value })
  }

  async function purchaseExpectRevert(beneficiary: Signer, value: BigNumber) {
    const beneficiaryAddress = await beneficiary.getAddress()
    await expect(crowdsale.connect(beneficiary).buyTokens(beneficiaryAddress, { value })).to.be.revertedWith(
      "WC: beneficiary doesn't have the correct role",
    )
    await expect(beneficiary.sendTransaction({ to: crowdsale.address, value })).to.be.revertedWith(
      "WC: beneficiary doesn't have the correct role",
    )
  }

  context('With no whitelisted addresses', function () {
    it('Should reject all purchases', async function () {
      await purchaseExpectRevert(notWhitelisted, value)
      await purchaseExpectRevert(whitelisted, value)
    })
  })

  context('With whitelisted addresses', function () {
    before(async function () {
      await crowdsale.grantRole(BENEFICIARY_ROLE, await whitelisted.getAddress())
      await crowdsale.grantRoles(BENEFICIARY_ROLE, [
        await secondWhitelisted.getAddress(),
        await thirdWhitelisted.getAddress(),
        await fourthWhitelisted.getAddress(),
        await fifthWhitelisted.getAddress(),
      ])
      await increaseTo(openingTime.add(duration.seconds(1)))
    })

    it('Should accept purchases with whitelisted beneficiaries', async function () {
      await purchaseShouldSucceed(whitelisted, value)
      await purchaseShouldSucceed(secondWhitelisted, value)
      await purchaseShouldSucceed(thirdWhitelisted, value)
      await purchaseShouldSucceed(fourthWhitelisted, value)
      await purchaseShouldSucceed(fifthWhitelisted, value)
    })

    it('Should reject if purchases from whitelisted addresses with non-whitelisted beneficiaries', async function () {
      const notWhitelistedAdd = await notWhitelisted.getAddress()
      await expect(crowdsale.connect(whitelisted).buyTokens(notWhitelistedAdd, { value })).to.be.reverted
    })

    it('Should reject purchases with non-whitelisted beneficiaries', async function () {
      await purchaseExpectRevert(notWhitelisted, value)
    })
  })
})
