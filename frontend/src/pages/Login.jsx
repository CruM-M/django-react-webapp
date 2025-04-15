import Form from "../components/Form"

function Login({ setIsAuthenticated }) {
    return <Form route="api/login/" method="login" setIsAuthenticated={setIsAuthenticated}/>
}

export default Login