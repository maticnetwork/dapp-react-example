import React from "react"
import WalletConnectProvider from "@maticnetwork/walletconnect-provider"
import Web3 from "web3"
import Matic from "maticjs"
import BigNumber from "bignumber.js"

import ERC20ABI from "./abi/ERC20"
import Header from "./components/header"

let storage = null
if (typeof window.localStorage !== "undefined") {
  storage = window.localStorage
}

const TEN = new BigNumber("10")

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = { address: null, toAddress: "", toAmount: 0.01 }
    this.checkAuth()
  }

  checkAuth = async () => {
    if (storage && storage.getItem("loggedIn")) {
      await this.connectToWallet()
    }
  }

  onConnect = () => {
    if (storage) {
      storage.setItem("loggedIn", true)
    }
  }

  onDisconnect = () => {
    this.setState({
      address: null
    })

    if (storage) {
      storage.removeItem("loggedIn")
    }
  }

  connectToWallet = async () => {
    const maticJSONData = await fetch(
      "https://wallet.matic.today/addresses.json"
    ).then(res => {
      return res.json()
    })
    const testnetData = maticJSONData["TestnetV2"]

    const maticProvider = new WalletConnectProvider({
      host: testnetData.Matic.RPC,
      callbacks: {
        onConnect: this.onConnect,
        onDisconnect: this.onDisconnect
      }
    })

    const ropstenProvider = new WalletConnectProvider({
      host: testnetData.Main.RPC,
      callbacks: {
        onConnect: this.onConnect,
        onDisconnect: this.onDisconnect
      }
    })

    const maticWeb3 = new Web3(maticProvider)
    const ropstenWeb3 = new Web3(ropstenProvider)
    const maticObj = new Matic({
      maticProvider: maticProvider,
      parentProvider: ropstenProvider,
      rootChainAddress: testnetData.Main.Contracts.RootChain,
      withdrawManagerAddress: testnetData.Main.Contracts.WithdrawManager,
      depositManagerAddress: testnetData.Main.Contracts.DepositManager,
      syncerUrl: testnetData.Matic.SyncerAPI,
      watcherUrl: testnetData.Main.WatcherAPI,
      maticWethAddress: testnetData.Matic.Contracts.ChildWETH
    })

    // fetch accounts
    maticWeb3.eth
      .getAccounts()
      .then(accounts => {
        // set address
        this.setState({
          testnetData,
          maticWeb3,
          ropstenWeb3,
          maticProvider,
          ropstenProvider,
          maticObj,
          address: accounts[0]
        })
      })
      .then(() => {
        return this.loadTokenBalance()
      })
  }

  disconnect = () => {
    const { maticProvider, ropstenProvider } = this.state
    if (maticProvider) {
      maticProvider.disconnect()
    }

    if (ropstenProvider) {
      ropstenProvider.disconnect()
    }

    this.onDisconnect()
  }

  connectScreen() {
    return (
      <div className="screen-middle-container d-flex justify-content-center">
        <div className="align-self-center">
          <button
            className="btn btn-primary btn-lg"
            onClick={this.connectToWallet}
          >
            Connect to Wallet
          </button>
        </div>
      </div>
    )
  }

  async loadTokenBalance() {
    const { address, maticWeb3, testnetData } = this.state
    const c = new maticWeb3.eth.Contract(
      ERC20ABI,
      testnetData.Matic.Contracts.ChildTestToken
    )

    const [balance, decimals] = await Promise.all([
      c.methods.balanceOf(address).call(),
      c.methods.decimals().call()
    ])

    this.setState({
      tokenBalance: new BigNumber(balance.toString())
        .div(TEN.pow(new BigNumber(decimals)))
        .toString(),
      tokenDecimals: decimals
    })
  }

  handleInputChange = event => {
    const target = event.target
    const value = target.type === "checkbox" ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value
    })
  }

  transferTokens = event => {
    event.preventDefault()
    const {
      address,
      tokenDecimals,
      toAddress,
      toAmount,
      testnetData,
      maticObj
    } = this.state
    const token = testnetData.Matic.Contracts.ChildTestToken
    const amount = new BigNumber(new BigNumber(toAmount)).times(
      TEN.pow(new BigNumber(tokenDecimals))
    )

    // transfer tokens
    const p = maticObj.transferTokens(token, toAddress, amount.toString(), {
      from: address,
      onTransactionHash: hash => {
        // action on Transaction success
        console.log(hash) // eslint-disable-line

        // load balanc again in some time
        setTimeout(() => {
          this.loadTokenBalance()
        }, 1000)
      }
    })
    console.log(p)
  }

  homeScreen() {
    const { address, tokenBalance, testnetData } = this.state
    return (
      <div className="container my-5">
        <div className="my-5 box">
          <div className="row d-flex justify-content-between p-3 m-0">
            <div className="align-self-center">
              <h5>Test token balance: {tokenBalance}</h5>
              <div className="small text-muted">
                Token address: {testnetData.Matic.Contracts.ChildTestToken}
              </div>
            </div>
            <div className="align-self-center">
              <a
                className="btn btn-warning mx-2"
                href={"https://wallet.matic.network/faucet?address=" + address}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get test tokens from faucet
              </a>
            </div>
          </div>
        </div>
        <div className="my-5 box">
          <h5 className="px-3 pt-3">Transfer tokens</h5>
          <div className="row d-flex justify-content-between p-3 m-0">
            <div className="align-self-center col p-0 pr-2">
              <input
                type="text"
                className="form-control"
                placeholder="Address"
                name="toAddress"
                value={this.state.toAddress}
                onChange={this.handleInputChange}
              />
            </div>
            <div className="align-self-center col p-0 pr-2">
              <input
                type="number"
                className="form-control"
                placeholder="Amount"
                name="toAmount"
                value={this.state.toAmount}
                onChange={this.handleInputChange}
              />
            </div>
            <div className="align-self-center">
              <button
                disabled={!this.state.toAddress || !this.state.toAmount}
                type="submit"
                className="btn btn-primary"
                onClick={this.transferTokens}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  render() {
    const { address, testnetData } = this.state
    return (
      <div>
        <Header
          address={address}
          testnetData={testnetData}
          disconnect={this.disconnect}
        />
        {!address ? this.connectScreen() : this.homeScreen()}
      </div>
    )
  }
}

export default App
