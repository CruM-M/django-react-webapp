import Form from "../components/Form"

function Register({ setIsAuthenticated }) {
    return <Form route="api/register/" method="register" setIsAuthenticated={setIsAuthenticated}/>
}

export default Register