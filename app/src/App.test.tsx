import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the Arabic heading and the three branches', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'طلبات المطعم' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /فرع/ })).toHaveLength(3)
  })

  it('increments and decrements the quantity, never below zero', async () => {
    const user = userEvent.setup()
    render(<App />)

    const increase = screen.getByRole('button', { name: 'زيادة الكمية' })
    const decrease = screen.getByRole('button', { name: 'تقليل الكمية' })
    const quantity = screen.getByTestId('quantity')

    await user.click(decrease)
    expect(quantity).toHaveTextContent('0')

    await user.click(increase)
    await user.click(increase)
    await user.click(decrease)
    expect(quantity).toHaveTextContent('1')
  })
})
