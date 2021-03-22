// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { Signer, BigNumber } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { advanceBlock, duration, increaseTo, latest } from './utils/time'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'

describe('CappedCrowdsale', function () {
  const rate = 50000
  const lessThanCap = expandTo18Decimals(250000 / rate)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const beneficiaryMinCapETH = expandTo18Decimals(200000 / rate)
  const beneficiaryHardCapETH = expandTo18Decimals(4000000 / rate)
  const withinBeneficiaryMinMaxCap = expandTo18Decimals(500000 / rate)
  const tokenSupply = expandTo18Decimals(200000000)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))
  const additionalLockPeriod = 100

  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let signer: Signer
  let otherSigner: Signer
  let tokenWallet: Signer
  let signerAddress: string
  let otherSignerAddress: string
  let tokenWalletAddress: string
  let cap: BigNumber
  let openingTime: BigNumber
  let closingTime: BigNumber
  let capInEther: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()

    const signers = await ethers.getSigners()
    signer = signers[1]
    otherSigner = signers[2]
    tokenWallet = signers[3]

    signerAddress = await signer.getAddress()
    otherSignerAddress = await otherSigner.getAddress()
    tokenWalletAddress = await tokenWallet.getAddress()

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()
  })

  beforeEach(async function () {
    openingTime = (await latest()).add(duration.weeks(1))
    closingTime = openingTime.add(duration.weeks(1))
  })

  describe('Contract deploy', function () {
    it('Should fail if a cap equals zero', async () => {
      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      await expect(
        Crowdsale.deploy(
          rate,
          signerAddress,
          yac.address,
          0,
          beneficiaryMinCapYACs,
          beneficiaryHardCapYACs,
          tokenWalletAddress,
          openingTime,
          closingTime,
          additionalLockPeriod,
        ),
      ).to.be.revertedWith('CC: cap is 0')
    })
  })

  context('With contract deployed', function () {
    describe('Validating token purchases with global cap', function () {
      beforeEach(async function () {
        cap = expandTo18Decimals(2000000)
        capInEther = expandTo18Decimals(2000000 / rate)

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
        await crowdsale.grantRole(BENEFICIARY_ROLE, signerAddress)
        await crowdsale.grantRole(BENEFICIARY_ROLE, otherSignerAddress)
        await yac.mint(tokenWalletAddress, tokenSupply)
        await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
        await increaseTo(openingTime.add(duration.seconds(1)))
      })

      it('Should accept multiple payments within cap', async () => {
        await expect(signer.sendTransaction({ to: crowdsale.address, value: lessThanCap })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.emit(crowdsale, 'TokensPurchased')
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.emit(crowdsale, 'TokensPurchased')
      })

      it('Should reject payments outside cap', async () => {
        const outsideCap = capInEther.add(lessThanCap)
        await expect(signer.sendTransaction({ to: crowdsale.address, value: outsideCap })).to.be.revertedWith(
          'CC: cap exceeded',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: outsideCap })).to.be.revertedWith('CC: cap exceeded')
      })

      it('Should reject payments that exceed cap', async () => {
        await crowdsale.buyTokens(signerAddress, { value: capInEther })
        await expect(crowdsale.buyTokens(otherSignerAddress, { value: lessThanCap })).to.be.revertedWith(
          'CC: cap exceeded',
        )
      })

      it('Should not reach cap if sent under cap', async () => {
        await crowdsale.buyTokens(signerAddress, { value: lessThanCap })
        expect(await crowdsale.capReached()).to.eq(false)
      })

      it('Should not reach cap if sent just under cap', async () => {
        await crowdsale.buyTokens(signerAddress, { value: capInEther.sub(1) })
        expect(await crowdsale.capReached()).to.eq(false)
      })

      it('Should reach cap if cap sent', async () => {
        await crowdsale.buyTokens(signerAddress, { value: capInEther })
        expect(await crowdsale.capReached()).to.eq(true)
      })
    })

    describe('Validating token purchases with beneficiary min and max cap', function () {
      beforeEach(async function () {
        cap = expandTo18Decimals(40000000)

        const token = await ethers.getContractFactory('ERC20Mock')
        yac = (await token.deploy()) as ERC20Mock
        await yac.deployed()

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
        await crowdsale.grantRole(BENEFICIARY_ROLE, signerAddress)
        await yac.mint(tokenWalletAddress, tokenSupply)
        await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
        await increaseTo(openingTime.add(duration.seconds(1)))
      })
      it('Should accept payments within beneficiary min and max cap', async () => {
        expect(await crowdsale.buyTokens(signerAddress, { value: withinBeneficiaryMinMaxCap })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
        expect(await crowdsale.buyTokens(signerAddress, { value: withinBeneficiaryMinMaxCap })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
      })

      it('Should accept payments equal to beneficiary min cap', async () => {
        expect(await crowdsale.buyTokens(signerAddress, { value: beneficiaryMinCapETH })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
      })

      it('Should accept payments equal to beneficiary max cap', async () => {
        expect(await crowdsale.buyTokens(signerAddress, { value: beneficiaryHardCapETH })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
      })

      it('Should reject payments outside beneficiary min cap', async () => {
        await expect(crowdsale.buyTokens(signerAddress, { value: beneficiaryMinCapETH.sub(1) })).to.be.revertedWith(
          'CC: beneficiary min cap not met',
        )
      })

      it('Should reject payments outside beneficiary max cap', async () => {
        await expect(crowdsale.buyTokens(signerAddress, { value: beneficiaryHardCapETH.add(1) })).to.be.revertedWith(
          'CC: contributing above beneficiary max cap',
        )
      })

      it('Should reject payments that exceed beneficiary max cap', async () => {
        expect(await crowdsale.buyTokens(signerAddress, { value: beneficiaryHardCapETH })).to.emit(
          crowdsale,
          'TokensPurchased',
        )
        await expect(crowdsale.buyTokens(signerAddress, { value: lessThanCap })).to.be.revertedWith(
          'CC: contributing above beneficiary max cap',
        )
      })
    })
  })
})
