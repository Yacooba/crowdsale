// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer } from 'ethers'
import { expect } from 'chai'
import { expandTo18Decimals } from './utils'
import { ERC20Mock, YacoobaCrowdsale } from '../typechain'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import { advanceBlock, duration, increaseTo, latest } from './utils/time'

describe('YacoobaCrowdsale', function () {
  const rate = 50000
  const cap = expandTo18Decimals(40000000)
  const beneficiaryMinCapYACs = expandTo18Decimals(200000)
  const beneficiaryHardCapYACs = expandTo18Decimals(4000000)
  const tokenSupply = expandTo18Decimals(200000000)
  const valueEther = expandTo18Decimals(5)
  const valueYacs = valueEther.mul(rate)
  const beneficiaryMinCapEther = expandTo18Decimals(200000 / rate)
  const beneficiaryHardCapEther = expandTo18Decimals(4000000 / rate)
  const BENEFICIARY_ROLE = keccak256(toUtf8Bytes('BENEFICIARY_ROLE'))
  const additionalLockPeriod = 100

  let yac: ERC20Mock
  let crowdsale: YacoobaCrowdsale
  let beneficiary: Signer
  let fundWallet: Signer
  let tokenWallet: Signer
  let fundWalletAddress: string
  let tokenWalletAddress: string
  let beneficiaryAddress: string
  let openingTime: BigNumber
  let closingTime: BigNumber

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock()
    ;[fundWallet, tokenWallet, beneficiary] = await ethers.getSigners()

    const token = await ethers.getContractFactory('ERC20Mock')
    yac = (await token.deploy()) as ERC20Mock
    await yac.deployed()

    fundWalletAddress = await fundWallet.getAddress()
    tokenWalletAddress = await tokenWallet.getAddress()
    beneficiaryAddress = await beneficiary.getAddress()
  })

  describe('Verify initialized values', function () {
    before(async function () {
      openingTime = (await latest()).add(duration.weeks(1))
      closingTime = openingTime.add(duration.weeks(1))

      const token = await ethers.getContractFactory('ERC20Mock')
      yac = (await token.deploy()) as ERC20Mock
      await yac.deployed()

      const yacoobaCrowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      crowdsale = (await yacoobaCrowdsale.deploy(
        rate,
        fundWalletAddress,
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
    })

    it('Should have the correct rate value', async () => {
      expect(await crowdsale.rate()).to.eq(rate)
    })

    it('Should have the correct fund wallet address', async () => {
      expect(await crowdsale.fundWallet()).to.eq(fundWalletAddress)
    })

    it('Should have the correct token address', async () => {
      expect(await crowdsale.token()).to.eq(yac.address)
    })

    it('Should have the correct cap value', async () => {
      expect(await crowdsale.cap()).to.eq(cap)
    })

    it('Should have the correct beneficiaryMinCap value', async () => {
      expect(await crowdsale.beneficiaryMinCap()).to.eq(beneficiaryMinCapEther.mul(rate))
    })

    it('Should have the correct beneficiaryHardCap value', async () => {
      expect(await crowdsale.beneficiaryMaxCap()).to.eq(beneficiaryHardCapEther.mul(rate))
    })

    it('Should have the correct openingTime value', async () => {
      expect(await crowdsale.openingTime()).to.eq(openingTime)
    })

    it('Should have the correct closingTime value', async () => {
      expect(await crowdsale.closingTime()).to.eq(closingTime)
    })

    it('Should have the correct tokenWallet address', async () => {
      expect(await crowdsale.tokenWallet()).to.eq(tokenWalletAddress)
    })
  })

  describe('Mint, transfer and increase allowance', function () {
    beforeEach(async function () {
      openingTime = (await latest()).add(duration.weeks(1))
      closingTime = openingTime.add(duration.weeks(1))
      const cap = expandTo18Decimals(60000000)

      const token = await ethers.getContractFactory('ERC20Mock')
      yac = (await token.deploy()) as ERC20Mock
      await yac.deployed()

      const Crowdsale = await ethers.getContractFactory('YacoobaCrowdsale')
      crowdsale = (await Crowdsale.deploy(
        rate,
        fundWalletAddress,
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
      await crowdsale.grantRole(BENEFICIARY_ROLE, beneficiaryAddress)
      await increaseTo(openingTime.add(duration.seconds(1)))
    })

    it('Should increase crowdsale smart contract allowance', async () => {
      await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
      expect(await yac.allowance(tokenWalletAddress, crowdsale.address)).to.eq(tokenSupply)
    })

    it('Should decrease crowdsale smart contract allowance after a purchase', async () => {
      await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
      expect(await yac.allowance(tokenWalletAddress, crowdsale.address)).to.eq(tokenSupply)
      expect(await crowdsale.remainingTokens()).to.eq(tokenSupply)
      await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })
      expect(await yac.allowance(tokenWalletAddress, crowdsale.address)).to.eq(tokenSupply.sub(valueYacs))
      expect(await crowdsale.remainingTokens()).to.eq(tokenSupply.sub(valueYacs))
    })
  })

  describe('Buy tokens', function () {
    beforeEach(async function () {
      openingTime = (await latest()).add(duration.weeks(1))
      closingTime = openingTime.add(duration.weeks(1))

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
      await yac.mint(tokenWalletAddress, tokenSupply)
      await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
      await crowdsale.grantRole(BENEFICIARY_ROLE, beneficiaryAddress)
      await increaseTo(openingTime.add(duration.seconds(1)))
    })

    it('Should buy tokens from the crowdsale', async () => {
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(0)
      expect(await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })).to.emit(crowdsale, 'TokensPurchased')
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(valueYacs)
    })

    it('Should buy tokens multiple times from the crowdsale', async () => {
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(0)
      await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(valueYacs)
      await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(valueYacs.mul(2))
    })
  })

  describe('Buy tokens', function () {
    beforeEach(async function () {
      openingTime = (await latest()).add(duration.weeks(1))
      closingTime = openingTime.add(duration.weeks(1))

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
      await yac.mint(tokenWalletAddress, tokenSupply)
      await yac.connect(tokenWallet).increaseAllowance(crowdsale.address, tokenSupply)
      await crowdsale.grantRole(BENEFICIARY_ROLE, beneficiaryAddress)
      await increaseTo(openingTime.add(duration.seconds(1)))
    })

    it('Should buy tokens from the crowdsale', async () => {
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(0)
      expect(await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })).to.emit(crowdsale, 'TokensPurchased')
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(valueYacs)
    })

    it('Should fail when someone tries to change rate', async () => {
      await expect(crowdsale.connect(beneficiary).setRate(40000)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should fail when setting rate to 0', async () => {
      await expect(crowdsale.setRate(0)).to.be.revertedWith('CS: rate is 0')
    })

    it('Should be able to change rate and purchase within the new rate', async () => {
      const newRate = BigNumber.from(40000)
      await crowdsale.setRate(newRate)
      expect(await crowdsale.rate()).to.be.equal(newRate)
      await crowdsale.buyTokens(beneficiaryAddress, { value: valueEther })
      const expectedValueYacs = valueEther.mul(newRate)
      expect(await crowdsale.balanceOf(beneficiaryAddress)).to.eq(expectedValueYacs)
    })
  })
})
