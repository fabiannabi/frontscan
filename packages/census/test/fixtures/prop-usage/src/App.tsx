export const App = (rest: object, label: string) => (
  <>
    <Button variant="primary" size={2}>Save</Button>
    <Button variant="ghost" disabled>Cancel</Button>
    <Button variant="primary" onClick={() => {}} />
    <Button {...rest} variant={label} />
  </>
);
