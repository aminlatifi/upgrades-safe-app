import React, { useState } from 'react'

import Address from './ethereum/Address'
import { ok, err } from './Result'
import { SafeUpgradesProps, Validation } from './types'
import { isProxyAdmin, isManaged } from './ethereum/Contract'
import { AddressInput, useAddressInput } from './AddressInput'

import styles from './css/style.module.css'

const SafeUpgrades: React.FC<SafeUpgradesProps> = ({ safe, ethereum }) => {
  const [proxyAdminAddress, setProxyAdminAddress] = useState<string | undefined>()
  const [currentImplementationAddress, setCurrentImplementationAddress] = useState<string | undefined>()


  const proxyInput = useAddressInput(async (address: Address) : Promise<Validation> => {
    setProxyAdminAddress(undefined)
    setCurrentImplementationAddress(undefined)

    const hasBytecode = await ethereum.hasBytecode(address)

    if (! hasBytecode) {
      return err('There is no contract in this address')
    }

    const Eip1967 = await ethereum.detect(address)

    if (Eip1967 === null) {
      return err('Only EIP1967-compatible proxies are supported')
    }

    const safeAddress = safe.info?.safeAddress || ''
    const { proxy, implementation } = Eip1967
    const { admin } = proxy

    console.log('implementation:', implementation)
    console.log('proxy:', proxy);
    // console.log('admin:', admin)

    if (isProxyAdmin(admin)) {

      if (isManaged(admin)) {
        console.log('admin.admin.address:', admin?.admin?.address)
        if ( ! admin.admin.address.isEquivalent(safeAddress)) {
          return err("This proxy's admin is not managed by this Safe")
        }

        setProxyAdminAddress(admin.address.toString())

      } else {
        return err("This proxy's admin is not managed by any address")
      }

    } else if ( ! admin.address.isEquivalent(safeAddress)) {
      return err('This proxy is not managed by this Safe')
    }

    setCurrentImplementationAddress(implementation.address.toString())
    return ok(undefined)
  })


  const newImplementationInput = useAddressInput(async (address: Address) : Promise<Validation> => {
    if (currentImplementationAddress && address.isEquivalent(currentImplementationAddress)) {
      return err('Proxy already points to this implementation')
    }

    const hasBytecode = await ethereum.hasBytecode(address)

    if (! hasBytecode) {
      return err('There is no contract in this address')
    }

    const Eip1967 = await ethereum.detect(address)

    if (Eip1967 !== null) {
      return err("New implementation can't be a proxy contract")
    }

    return ok(undefined)
  })


  const sendTransaction = () : void => {
    const tx = ethereum.buildUpgradeTransaction(proxyInput.address, newImplementationInput.address, proxyAdminAddress)
    safe.sdk.sendTransactions([tx])
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>

        <h4>Upgrade a contract</h4>

        <button
          type="button"
          name="submit"
          onClick={ sendTransaction }
          disabled={ ! (proxyInput.isValid && newImplementationInput.isValid) } >
          Upgrade
        </button>

      </div>

      <AddressInput
        name='proxy'
        label='Contract address'
        input={ proxyInput }
      />

      <AddressInput
        name='new-implementation'
        label='New implementation address'
        input={ newImplementationInput }
      />

      { proxyInput.isValid !== undefined || newImplementationInput.isValid === false

        ? <div className={styles.details}>
            <ul className={styles.nobullet}>

              { proxyInput.isValid !== undefined
                ? ( proxyInput.isValid
                  ? <li className={styles.success}>
                      <p className={styles.title}>This contract is EIP1967-compatible</p>
                    </li>

                  : <li className={styles.error}>
                      <p className={styles.title}>Invalid contract address</p>
                      <p id="proxy-input-error" className={styles.description}>{ proxyInput.error }</p>
                    </li>
                  )
                : <></>
              }

              { newImplementationInput.isValid === false
                ? <li className={styles.error}>
                    <p className={styles.title}>Invalid new implementation address</p>
                    <p id="new-implementation-input-error" className={styles.description}>{ newImplementationInput.error }</p>
                  </li>
                : <></>
              }

            </ul>
          </div>
        : <></>
      }

      <footer><a href="https://docs.openzeppelin.com/upgrades" target="_blank" rel="noopener noreferrer">Powered by <img src="oz_icon.svg" alt="OpenZeppelin" /><b>OpenZeppelin</b> | Upgrades</a></footer>
    </div>
  )
}


export default SafeUpgrades
