import React, { useState, useEffect } from 'react'
import { useRouteMatch, useHistory } from 'react-router-dom'
import dayjs from 'dayjs'

import { formInput, formFeedback } from 'utils/formHelpers'
import useConfig from 'utils/useConfig'
import useRest from 'utils/useRest'
import Link from 'components/Link'

const times = Array(48)
  .fill(0)
  .map((o, idx) => {
    const time = dayjs('2018-01-01').add(idx * 30, 'm')
    return [time.format('HH:mm:00'), time.format('h:mm A')]
  })

function validate(state) {
  const newState = {}

  if (!state.code) {
    newState.codeError = 'Enter a discount code'
  } else if (state.code.length < 3) {
    newState.codeError = 'Code is too short'
  }
  if (!state.value) {
    newState.valueError = 'Enter a value'
  } else if (Number(state.value) <= 0) {
    newState.valueError = 'Value must be greater than zero'
  }

  const valid = Object.keys(newState).every(f => f.indexOf('Error') < 0)

  return { valid, newState: { ...state, ...newState } }
}

const defaultValues = {
  discountType: 'percentage',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
  status: 'active'
}

const AdminEditDiscount = () => {
  const { config } = useConfig()
  const history = useHistory()
  const [shouldDelete, setDelete] = useState()
  const match = useRouteMatch('/admin/discounts/:discountId')
  const { discountId } = match.params
  const { data: discount } = useRest(`/discounts/${discountId}`, {
    skip: discountId === 'new'
  })
  const [state, setStateRaw] = useState(defaultValues)
  const setState = newState => setStateRaw({ ...state, ...newState })
  useEffect(() => {
    if (discount) {
      setState({
        ...discount,
        endDateEnabled: discount.endTime ? true : false,
        startDate: dayjs(discount.startTime).format('YYYY-MM-DD'),
        endDate: dayjs(discount.endTime).format('YYYY-MM-DD'),
        startTime: dayjs(discount.startTime).format('HH:mm:ss'),
        endTime: dayjs(discount.endTime).format('HH:mm:ss')
      })
    } else {
      setStateRaw(defaultValues)
    }
  }, [discount])

  const input = formInput(state, newState => setState(newState))
  const Feedback = formFeedback(state)
  const title = `${discountId === 'new' ? 'Create' : 'Edit'} Discount`

  return (
    <>
      <h3 className="admin-title with-border">
        <Link to="/admin/discounts" className="muted">
          Discounts
        </Link>
        <span className="chevron" />
        {title}
      </h3>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const { valid, newState } = validate(state)
          setState(newState)
          if (valid) {
            let url = `${config.backend}/discounts`
            if (discount && discount.id) {
              url += `/${discount.id}`
            }

            const startTimeS = `${newState.startDate} ${newState.startTime}`
            const endTimeS = `${newState.endDate} ${newState.endTime}`
            const startTime = dayjs(startTimeS, 'YYYY-MM-DD HH:mm:ss').format()
            const endTime = newState.endDateEnabled
              ? dayjs(endTimeS, 'YYYY-MM-DD HH:mm:ss').format()
              : null

            const raw = await fetch(url, {
              headers: {
                authorization: `bearer ${config.backendAuthToken}`,
                'content-type': 'application/json'
              },
              credentials: 'include',
              method: discount && discount.id ? 'PUT' : 'POST',
              body: JSON.stringify({
                discountType: newState.discountType,
                value: Number(newState.value),
                startTime,
                endTime,
                code: newState.code,
                status: newState.status,
                maxUses: newState.maxUses ? Number(newState.maxUses) : null,
                onePerCustomer: newState.onePerCustomer ? true : false,
                excludeShipping: newState.excludeShipping ? true : false
              })
            })
            if (raw.ok) {
              history.push({
                pathname: '/admin/discounts',
                state: { scrollToTop: true }
              })
            }
          } else {
            window.scrollTo(0, 0)
          }
        }}
      >
        <div className="form-row">
          <div className="form-group col-md-6" style={{ maxWidth: '15rem' }}>
            <label>Discount Code</label>
            <input type="code" {...input('code')} />
            {Feedback('code')}
          </div>
          <div className="form-group col-md-6" style={{ maxWidth: '15rem' }}>
            <label>Status</label>
            <select {...input('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {Feedback('status')}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group col-md-6" style={{ maxWidth: '15rem' }}>
            <label>Type</label>
            <div className="form-check">
              <label className="form-check-label">
                <input
                  className="form-check-input"
                  type="radio"
                  name="type"
                  checked={state.discountType === 'percentage'}
                  onChange={() => setState({ discountType: 'percentage' })}
                />
                Percentage
              </label>
            </div>
            <div className="form-check">
              <label className="form-check-label">
                <input
                  className="form-check-input"
                  type="radio"
                  name="type"
                  checked={state.discountType === 'fixed'}
                  onChange={() => setState({ discountType: 'fixed' })}
                />
                Fixed amount
              </label>
            </div>
          </div>
          <div className="form-group col-md-6" style={{ maxWidth: '15rem' }}>
            <label>Discount Value</label>
            <div className="input-group">
              {state.discountType !== 'fixed' ? null : (
                <div className="input-group-prepend">
                  <span className="input-group-text">$</span>
                </div>
              )}
              <input type="text" {...input('value')} />
              {state.discountType === 'fixed' ? null : (
                <div className="input-group-append">
                  <span className="input-group-text">%</span>
                </div>
              )}
            </div>
            {Feedback('value')}
          </div>
        </div>
        <div className="form-check mb-3">
          <label className="form-check-label">
            <input
              className="form-check-input"
              type="checkbox"
              checked={state.excludeShipping ? true : false}
              onChange={e => setState({ excludeShipping: e.target.checked })}
            />
            Exclude shipping price from discount
          </label>
        </div>
        {/* <div className="form-group" style={{ maxWidth: '15rem' }}>
          <label>Max Uses</label>
          <input type="text" {...input('maxUses')} />
          {Feedback('maxUses')}
        </div>
        <div className="form-check mb-3">
          <label className="form-check-label">
            <input
              className="form-check-input"
              type="checkbox"
              checked={state.onePerCustomer ? true : false}
              onChange={e => setState({ onePerCustomer: e.target.checked })}
            />
            One Per Customer
          </label>
        </div> */}
        <div className="form-row mb-3" style={{ maxWidth: '30rem' }}>
          <div className="col-6">
            <label>Start Date</label>
            <input type="date" {...input('startDate')} required />
            {Feedback('startDate')}
          </div>
          <div className="col-6">
            <label>Start Time</label>
            <select {...input('startTime')}>
              {times.map((time, idx) => (
                <option key={idx} value={time[0]}>
                  {time[1]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-check mb-3">
          <label className="form-check-label">
            <input
              className="form-check-input"
              type="checkbox"
              name="type"
              checked={state.endDateEnabled ? true : false}
              onChange={e => setState({ endDateEnabled: e.target.checked })}
            />
            Set end date
          </label>
        </div>
        {!state.endDateEnabled ? null : (
          <div className="form-row mb-3" style={{ maxWidth: '30rem' }}>
            <div className="col-6">
              <label>End Date</label>
              <input type="date" {...input('endDate')} required />
              {Feedback('endDate')}
            </div>
            <div className="col-6">
              <label>End Time</label>
              <select {...input('endTime')}>
                {times.map((time, idx) => (
                  <option key={idx} value={time[0]}>
                    {time[1]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
          {!discount ? null : (
            <>
              <button
                type="button"
                className="btn btn-outline-danger ml-2 mr-3"
                onClick={() => setDelete(true)}
              >
                Delete
              </button>
              {!shouldDelete ? null : (
                <>
                  Are you sure?
                  <button
                    type="button"
                    className="btn btn-danger ml-2"
                    onClick={async () => {
                      const headers = new Headers({
                        authorization: `bearer ${config.backendAuthToken}`,
                        'content-type': 'application/json'
                      })
                      const url = `${config.backend}/discounts/${discount.id}`
                      const myRequest = new Request(url, {
                        headers,
                        credentials: 'include',
                        method: 'DELETE'
                      })
                      const raw = await fetch(myRequest)
                      if (raw.ok) {
                        history.push({
                          pathname: '/admin/discounts',
                          state: { scrollToTop: true }
                        })
                      }
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary ml-2"
                    onClick={() => setDelete(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </form>
    </>
  )
}

export default AdminEditDiscount

require('react-styl')(`
`)
