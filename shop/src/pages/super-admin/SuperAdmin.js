import React, { useEffect, useState } from 'react'
import { Redirect, Switch, Route } from 'react-router-dom'
import get from 'lodash/get'
// import Styl from 'react-styl'
import 'components/admin/Styles'

import { useStateValue } from 'data/state'
import useConfig from 'utils/useConfig'

import Login from './Login'
import Menu from './_Menu'
import FirstTime from './setup/FirstTime'

import Shops from './shops/Shops'
import NewShop from './shops/NewShop'
import Dashboard from './Dashboard'
import Settings from './Settings'

const SuperAdmin = () => {
  const { config } = useConfig()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState()

  const [{ admin, reload }, dispatch] = useStateValue()

  useEffect(() => {
    // if (!window.backendAdminCss) {
    //   // Need to re-add stylesheet as this component is lazy loaded
    //   Styl.addStylesheet()
    //   window.backendAdminCss = true
    // }

    fetch(`${config.backend}/superuser/auth`, { credentials: 'include' })
      .then(async response => {
        if (response.status === 200) {
          const auth = await response.json()
          dispatch({ type: 'setAuth', auth })
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
      })
  }, [reload.auth])

  if (error) {
    return <div className="fixed-loader">Admin Connection Error</div>
  } else if (loading && !admin) {
    return <div className="fixed-loader">Loading...</div>
  }

  if (!get(admin, 'success')) {
    if (!admin || admin.reason === 'not-logged-in') {
      return <Login next={() => dispatch({ type: 'reload', target: 'auth' })} />
    }
    return (
      <FirstTime next={() => dispatch({ type: 'reload', target: 'auth' })} />
    )
  }

  return (
    <div className="backend-admin">
      <div className="admin">
        <nav>
          <div className="container">
            <h1>
              <img src="images/dshop-logo.svg" />
              <div>Super Admin</div>
            </h1>
            <div>{`Welcome, ${admin.email}`}</div>
          </div>
        </nav>
        <div className="container">
          <div className="row">
            <div className="col-md-3">
              <Menu />
            </div>
            <div className="col-md-9">
              <Switch>
                <Route path="/super-admin/shops/new" component={NewShop} />
                <Route path="/super-admin/shops" component={Shops} />
                <Route path="/super-admin/settings" component={Settings} />
                <Route path="/super-admin/dashboard" component={Dashboard} />
                <Redirect to="/super-admin/dashboard" />
              </Switch>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdmin

require('react-styl')(`
`)
