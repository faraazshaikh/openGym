import { describe, expect, it } from 'vitest'
import { inviteFromSearch, inviteLink, inviteMessage } from './invite-message.js'

describe('inviteLink', () => {
  it('puts the code in the query of the server address, whatever the trailing slash', () => {
    expect(inviteLink('https://fit.example.com', 'AB12')).toBe('https://fit.example.com/?invite=AB12')
    expect(inviteLink('https://fit.example.com/', 'AB12')).toBe('https://fit.example.com/?invite=AB12')
  })
})

describe('inviteFromSearch', () => {
  it('reads the code and upper-cases it', () => {
    expect(inviteFromSearch('?invite=ab12cd')).toBe('AB12CD')
    expect(inviteFromSearch('?x=1&invite=a-b_c')).toBe('A-B_C')
  })
  it('ignores anything that is not a plain code', () => {
    expect(inviteFromSearch('')).toBe('')
    expect(inviteFromSearch('?invite=')).toBe('')
    expect(inviteFromSearch('?invite=<script>')).toBe('')
    expect(inviteFromSearch('?invite=' + 'A'.repeat(41))).toBe('')
    expect(inviteFromSearch(undefined)).toBe('')
  })
  it('round-trips what inviteLink makes', () => {
    const link = new URL(inviteLink('https://fit.example.com', '8F3A9C'))
    expect(inviteFromSearch(link.search)).toBe('8F3A9C')
  })
})

describe('inviteMessage', () => {
  const base = 'https://fit.example.com'
  it('has the link, the email to use, the code and how long they get', () => {
    const m = inviteMessage({ base, invite: { name: 'Alex', email: 'alex@example.com', code: 'AB12CD', months: 3 } })
    expect(m).toContain('Hi Alex, you\'re invited to Fitrix')
    expect(m).toContain('https://fit.example.com/?invite=AB12CD')
    expect(m).toContain('Sign up with alex@example.com')
    expect(m).toContain('AB12CD')
    expect(m).toContain('You get 3 months, counted from the day you sign up.')
  })
  it('says 1 month in the singular, and no end date for an indefinite invite', () => {
    expect(inviteMessage({ base, invite: { code: 'X1', months: 1 } })).toContain('You get 1 month, counted')
    expect(inviteMessage({ base, invite: { code: 'X1', months: null } })).toContain('Your access has no end date.')
  })
  it('copes with an older invite that has no name or email, and has no em dashes', () => {
    const m = inviteMessage({ base, invite: { code: 'X1' } })
    expect(m).toContain("You're invited")
    expect(m).toContain('Sign up with your name.')
    expect(m).not.toContain('—')
  })
})
