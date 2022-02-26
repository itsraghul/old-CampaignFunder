const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

const compiledFactory = require('../ethereum/build/CampaignFactory.json');
const compiledCampaignFunder = require('../ethereum/build/CampaignFunder.json');

let accounts;
let factory;
let campaignAddress;
let campaign;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  factory = await new web3.eth.Contract(compiledFactory.abi)
    .deploy({ data: compiledFactory.evm.bytecode.object })
    .send({ from: accounts[0], gas: '3000000' });

  await factory.methods
    .createCampaign('100')
    .send({ from: accounts[0], gas: '3000000' });

  [campaignAddress] = await factory.methods.getDeployedCampaigns().call();

  campaign = await new web3.eth.Contract(
    compiledCampaignFunder.abi,
    campaignAddress
  );
});

describe('Campaigns', () => {
  it('deploys a factory and campaign', () => {
    assert.ok(factory.options.address);
    assert.ok(campaign.options.address);
  });

  it('marks caller as the campaign manager', async () => {
    const manager = await campaign.methods.manager().call();
    assert.equal(accounts[0], manager);
  });

  it('allows people to contribute money and marks them approvers', async () => {
    await campaign.methods
      .contribute()
      .send({ from: accounts[1], value: '100000' });
    const isContributor = await campaign.methods.approvers(accounts[1]).call();
    assert.equal(true, isContributor);
  });

  it('requires  a minimum contribution', async () => {
    try {
      await campaign.methods
        .contribute()
        .send({ value: '10', from: accounts[1] });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });

  it('allows a manager to make a payment request', async () => {
    await campaign.methods
      .createRequest('new request', '1000', accounts[4])
      .send({ from: accounts[0], gas: '1000000' });
    const request = await campaign.methods.requests(0).call();
    assert.equal('new request', request.description);
  });

  it('processes request ', async () => {
    await campaign.methods.contribute().send({
      from: accounts[0],
      value: web3.utils.toWei('10', 'ether'),
    });

    await campaign.methods
      .createRequest(
        'new only request',
        web3.utils.toWei('5', 'ether'),
        accounts[1]
      )
      .send({ from: accounts[0], gas: '1000000' });

    await campaign.methods
      .approveRequest(0)
      .send({ from: accounts[0], gas: '1000000' });

    await campaign.methods
      .finalizeRequest(0)
      .send({ from: accounts[0], gas: '1000000' });

    let balance = await web3.eth.getBalance(accounts[1]);
    balance = web3.utils.fromWei(balance, 'ether');
    balance = parseFloat(balance);
    console.log(balance);
    assert(balance > 102);
  });
});