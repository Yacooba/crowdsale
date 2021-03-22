// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { advanceBlock, latest, duration, increaseTo } from './utils/time'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'

describe('TimedCrowdsale', function () {
  const rate = 50000
  const cap = expandTo18Decimals(40000000)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const lessThanCap = expandTo18Decimals(250000 / rate)
  const tokenSupply = expandTo18Decimals(200000000)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))
  const additionalLockPeriod = 100

  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let signer: Signer
  let tokenWallet: Signer
  let signerAddress: string
  let tokenWalletAddress: string
  let openingTime: BigNumber
  let closingTime: BigNumber
  let afterClosingTime: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()

    const signers = await ethers.getSigners()
    signer = signers[1]
    tokenWallet = signers[2]
    signerAddress = await signer.getAddress()
    tokenWalletAddress = await tokenWallet.getAddress()

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()
  })

  beforeEach(async function () {
    openingTime = (await latest()).add(duration.weeks(1))
    closingTime = openingTime.add(duration.weeks(1))
    afterClosingTime = closingTime.add(duration.seconds(1))
  })

  context('deploy', function () {
    it('Should fail if opening time is in the past', async () => {
      const wrongOpeningTime = (await latest()).sub(duration.days(1))
      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      await expect(
        Crowdsale.deploy(
          rate,
          signerAddress,
          yac.address,
          cap,
          beneficiaryMinCapYACs,
          beneficiaryHardCapYACs,
          tokenWalletAddress,
          wrongOpeningTime,
          closingTime,
          additionalLockPeriod,
        ),
      ).to.be.revertedWith('TC: opening time is before current time')
    })

    it('Should fail if the closing time is before the opening time', async () => {
      const wrongClosingTime = openingTime.sub(duration.seconds(1))
      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      await expect(
        Crowdsale.deploy(
          rate,
          signerAddress,
          yac.address,
          cap,
          beneficiaryMinCapYACs,
          beneficiaryHardCapYACs,
          tokenWalletAddress,
          openingTime,
          wrongClosingTime,
          additionalLockPeriod,
        ),
      ).to.be.revertedWith('TC: opening time is not before closing time')
    })

    it('Should fail if the closing time equals the opening time', async () => {
      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      await expect(
        Crowdsale.deploy(
          rate,
          signerAddress,
          yac.address,
          cap,
          beneficiaryMinCapYACs,
          beneficiaryHardCapYACs,
          tokenWalletAddress,
          openingTime,
          openingTime,
          additionalLockPeriod,
        ),
      ).to.be.revertedWith('TC: opening time is not before closing time')
    })
  })

  context('with crowdsale', function () {
    beforeEach(async function () {
      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      crowdsale = (await Crowdsale.deploy(
        rate,
        tokenWalletAddress,
        yac.address,
        cap,
        beneficiaryMinCapYACs,
        beneficiaryHardCapYACs,
        tokenWalletAddress,
        openingTime,
        closingTime,
        additionalLockPeriod,
      )) as YacoobaCrowdsale
      await crowdsale.deployed()

      await yac.mint(tokenWalletAddress, tokenSupply)
      await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
      await crowdsale.grantRole(BENEFICIARY_ROLE, signerAddress)
    })

    it('Should be ended only after end', async () => {
      expect(await crowdsale.hasClosed()).to.equal(false)
      await increaseTo(afterClosingTime)
      expect(await crowdsale.isOpen()).to.equal(false)
      expect(await crowdsale.hasClosed()).to.equal(true)
    })

    describe('Validating token purchases', function () {
      it('Should reject payments before start', async () => {
        expect(await crowdsale.isOpen()).to.equal(false)
        await expect(signer.sendTransaction({ to: crowdsale.address, value: lessThanCap })).to.be.revertedWith(
          'TC: not open',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.be.revertedWith('TC: not open')
      })

      it('Should accept payments after start', async () => {
        await increaseTo(openingTime)
        expect(await crowdsale.isOpen()).to.equal(true)
        await expect(signer.sendTransaction({ to: crowdsale.address, value: lessThanCap })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.emit(crowdsale, 'TokensPurchased')
      })

      it('Should reject payments after end', async () => {
        await increaseTo(afterClosingTime)
        expect(await crowdsale.hasClosed()).to.equal(true)
        await expect(signer.sendTransaction({ to: crowdsale.address, value: lessThanCap })).to.be.revertedWith(
          'TC: not open',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.be.revertedWith('TC: not open')
      })
    })

    describe('Validating time extension', function () {
      it('Should fail if new closingTime equals old closingTime', async () => {
        await expect(crowdsale.extendTime(closingTime)).to.be.revertedWith(
          'TC: new closing time is before current closing time',
        )
      })

      it('Should fail if new closingTime is before old closingTime', async () => {
        const newClosingTime = closingTime.sub(duration.seconds(1))
        await expect(crowdsale.extendTime(newClosingTime)).to.be.revertedWith(
          'TC: new closing time is before current closing time',
        )
      })

      it('Should fail if sender is not the owner', async () => {
        const newClosingTime = closingTime.add(duration.days(1))
        await expect(crowdsale.connect(signer).extendTime(newClosingTime)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        )
      })

      context('Before crowdsale start', function () {
        beforeEach(async function () {
          expect(await crowdsale.isOpen()).to.equal(false)
          await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.be.revertedWith('TC: not open')
        })

        it('Should extend end time', async () => {
          const newClosingTime = closingTime.add(duration.days(1))
          await expect(crowdsale.extendTime(newClosingTime))
            .to.emit(crowdsale, 'TimedCrowdsaleExtended')
            .withArgs(closingTime, newClosingTime)
        })
      })

      context('After crowdsale start', function () {
        beforeEach(async function () {
          await increaseTo(openingTime)
          expect(await crowdsale.isOpen()).to.equal(true)
          expect(await crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.emit(crowdsale, 'TokensPurchased')
        })

        it('Should extend end time', async () => {
          const newClosingTime = closingTime.add(duration.days(1))
          await expect(crowdsale.extendTime(newClosingTime))
            .to.emit(crowdsale, 'TimedCrowdsaleExtended')
            .withArgs(closingTime, newClosingTime)
        })
      })

      context('After crowdsale end', function () {
        beforeEach(async function () {
          await increaseTo(afterClosingTime)
          expect(await crowdsale.hasClosed()).to.equal(true)
        })

        it('Should fail to extend end time', async () => {
          const newClosingTime = await latest()
          await expect(crowdsale.extendTime(newClosingTime)).to.be.revertedWith('TC: already closed')
        })
      })
    })
  })
})
