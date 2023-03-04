import { expect } from "chai";
import { ethers } from 'hardhat';
import { LazyMinter } from'../lib/lazyMinter';
import { BloodOfMolochClaimNFT } from '../types';

describe("Claim NFT", function() {
  async function deploy() {
    const [minter, mockPBT, rando] = await ethers.getSigners();
  
    let factory = await ethers.getContractFactory("BloodOfMolochClaimNFT", minter)
    const contract = await factory.deploy(minter.address, mockPBT.address) as BloodOfMolochClaimNFT;
  
    return {
      minter,
      mockPBT,
      rando,
      contract,
    }
  }
  let minPrice = ethers.utils.parseEther(".001");
  const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

  it("Should deploy", async function() {
    const signers = await ethers.getSigners();
    const minter = signers[0];

    const LazyNFT = await ethers.getContractFactory("BloodOfMolochClaimNFT");
    const lazynft = await LazyNFT.deploy(minter.address, signers[1].address);
    await lazynft.deployed();
  });

  it("Should mint an NFT from minter role", async function() {
    const { contract, mockPBT, minter } = await deploy()

    const receipt = contract.connect(minter).mint()

    const tokenId = 1
    await expect(receipt)
      .to.emit(contract, "Minted").withArgs(tokenId)
      .and.to.emit(contract, "Transfer").withArgs(NULL_ADDRESS, minter.address, tokenId)
  });

  it("Should revert mint if not minter role", async function () {
    const { contract, mockPBT, minter, rando } = await deploy()

    const receipt = contract.connect(rando).mint()

    await expect(receipt)
      .to.be.reverted
  })

  it("Should batchMint quantity of NFTs as minter role", async function () {
    const { contract, mockPBT, minter } = await deploy()

    const quantity = 10
    const receipt = contract.connect(minter).batchMint(quantity)

    for(let i=0; i < quantity; i++) {
      await expect(receipt)
        .to.emit(contract, "Minted").withArgs(i + 1)
        .and.to.emit(contract, "Transfer").withArgs(NULL_ADDRESS, minter.address, i + 1)
    }
  })

  it("Should revert batchMint if not minter role", async function () {
    const { contract, mockPBT, minter, rando } = await deploy()

    const receipt = contract.connect(rando).batchMint(10)

    await expect(receipt)
      .to.be.reverted
  })

	it("Should revert mint/batchMint if supply is 350", async function () {
		const { contract, mockPBT, minter } = await deploy()

    const quantity = 350
    await contract.connect(minter).batchMint(quantity)

		let revertedTx = contract.connect(minter).mint()
		await expect(revertedTx).to.be.revertedWith("BloodOfMolochClaimNFT: cannot exceed max supply")

		revertedTx = contract.connect(minter).batchMint(5)
		await expect(revertedTx).to.be.revertedWith("BloodOfMolochClaimNFT: cannot exceed max supply")
	})

	it("Should burn if operator is PBT", async function () {
		const { contract, mockPBT, minter } = await deploy()
		await contract.connect(minter).mint()

		const tokenId = 1
		const receipt = contract.connect(mockPBT).burn(tokenId)

		await expect(receipt).to.not.be.reverted
	})

	it("Should revert burn if not PBT or token owner", async function () {
		const { contract, mockPBT, minter, rando } = await deploy()
		await contract.connect(minter).mint()

		const tokenId = 1
		const receipt = contract.connect(rando).burn(tokenId)

		await expect(receipt).to.be.reverted
	})

  xit("Should fail to redeem an NFT that's already been claimed", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter( contract, minter)
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", 0)

    await expect(redeemerContract.redeem(redeemer.address, voucher, signature))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      .withArgs('0x0000000000000000000000000000000000000000', minter.address, voucher.tokenId)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      .withArgs(minter.address, redeemer.address, voucher.tokenId);

    await expect(redeemerContract.redeem(redeemer.address, voucher, signature))
      .to.be.revertedWith('cannot claim an already minted token')
  });

  xit("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async function() {
    const { contract, redeemerContract, redeemer, rando } = await deploy()

    
    const lazyMinter = new LazyMinter(contract, rando)
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)

    await expect(redeemerContract.redeem(redeemer.address, voucher, signature))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  xit("Should fail to redeem an NFT voucher that's been modified", async function() {
    const { contract, redeemerContract, redeemer, rando } = await deploy()

    const lazyMinter = new LazyMinter(contract, rando)
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)
    voucher.tokenId = 2
    await expect(redeemerContract.redeem(redeemer.address, voucher, signature))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  xit("Should fail to redeem an NFT voucher with an invalid signature", async function() {
    const { contract, redeemerContract, redeemer, minter, rando } = await deploy()

    
    const lazyMinter = new LazyMinter(contract, rando)
    const {voucher} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)

    const dummyData = ethers.utils.randomBytes(128)
    const signature = await minter.signMessage(dummyData)
    
    await expect(redeemerContract.redeem(redeemer.address, voucher, signature))
      .to.be.revertedWith('Signature invalid or unauthorized')
  });

  xit("Should redeem if payment is >= minPrice", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter( contract, minter )
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)

    await expect(redeemerContract.redeem(redeemer.address, voucher, signature, { value: minPrice }))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      .withArgs('0x0000000000000000000000000000000000000000', minter.address, voucher.tokenId)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      .withArgs(minter.address, redeemer.address, voucher.tokenId)
  })

  xit("Should fail to redeem if payment is < minPrice", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter( contract, minter )
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)

    const payment = minPrice.sub(10000)
    await expect(redeemerContract.redeem(redeemer.address, voucher, signature, { value: payment }))
      .to.be.revertedWith('Insufficient funds to redeem')
  });

  xit("Should make payments available to minter for withdrawal", async function() {
    const { contract, redeemerContract, redeemer, minter } = await deploy()

    const lazyMinter = new LazyMinter( contract, minter )
    const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
    const {voucher, signature} = await lazyMinter.createVoucher(1, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice)
    
    // the payment should be sent from the redeemer's account to the contract address
    await expect(await redeemerContract.redeem(redeemer.address, voucher, signature, { value: minPrice }))
      .to.changeEtherBalances([redeemer, contract], [minPrice.mul(-1), minPrice]) 

    // minter should have funds available to withdraw
    expect(await contract.availableToWithdraw()).to.equal(minPrice)

    // withdrawal should increase minter's balance
    await expect(await contract.withdraw())
      .to.changeEtherBalance(minter, minPrice)

    // minter should now have zero available
    expect(await contract.availableToWithdraw()).to.equal(0)
  });
  xit("should create 350 vouchers and redeem them", async function() {
    const { contract, minter, redeemer } = await deploy();

    const lazyMinter = new LazyMinter(contract, minter);
    const minPrice = ethers.utils.parseEther(".001");
    let vouchersWSig = [];
    for(let i =0; i<350; i++){
        const voucherWSig = await lazyMinter.createVoucher(i, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", minPrice);
        vouchersWSig.push(voucherWSig);
    }
    expect(vouchersWSig.length).to.eq(350);

    vouchersWSig.forEach(async (voucher)=> {
      await expect(contract.connect(redeemer).redeem(redeemer.address, voucher.voucher, voucher.signature, {value: minPrice}))
      .to.emit(contract, 'Transfer')  // transfer from null address to minter
      .withArgs('0x0000000000000000000000000000000000000000', minter.address, voucher.voucher.tokenId)
      .and.to.emit(contract, 'Transfer') // transfer from minter to redeemer
      .withArgs(minter.address, redeemer.address, voucher.voucher.tokenId)

    });
  })

});
